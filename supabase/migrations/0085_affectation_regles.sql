-- L6, P6.4 — affecter un programme à un abonné, et l'accès du client à ses séances (décor :
-- 0084). docs/prompts/L6.md, décisions 2 à 5 ; docs/domaine.md §3.6, §4.6.

-- Le client a-t-il accès au contenu de ce coach ? Décision 2 : actif, résiliation programmée
-- (le mois est payé), impayé (relance, avant suspension).
create or replace function public.acces_contenu(p_profil_client_id uuid, p_profil_coach_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.abonnements a
     where a.profil_client_id = p_profil_client_id
       and a.profil_coach_id = p_profil_coach_id
       and a.statut in ('actif', 'resiliation_programmee', 'impaye')
  );
$$;

-- Le profil client du compte connecté, en espace client ; refus sinon.
create or replace function public.mon_profil_client_en_espace_client()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or public.profil_actif_courant() is distinct from 'client' then
    raise exception 'profil_client_requis';
  end if;
  select id into v_id from public.profils_client where compte_id = auth.uid();
  if v_id is null then
    raise exception 'profil_client_requis';
  end if;
  return v_id;
end;
$$;

-- La séance programmée du client connecté ; refus si elle n'est pas à lui, ou sans accès.
create or replace function public.ma_seance_programmee_verifiee(p_seance_programmee_id uuid)
returns public.seances_programmees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sp public.seances_programmees;
begin
  select * into v_sp from public.seances_programmees
   where id = p_seance_programmee_id
     and profil_client_id = public.mon_profil_client_en_espace_client();
  if v_sp.id is null then
    raise exception 'seance_introuvable';
  end if;
  if not public.acces_contenu(v_sp.profil_client_id, v_sp.profil_coach_id) then
    raise exception 'abonnement_sans_acces';
  end if;
  return v_sp;
end;
$$;

create or replace function public.abonnes_affectables()
returns table (profil_client_id uuid, prenom text, initiale_nom text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct pcl.id, pcl.prenom, left(coalesce(pcl.nom, ''), 1)
    from public.abonnements a
    join public.profils_client pcl on pcl.id = a.profil_client_id
   where a.profil_coach_id = public.mon_profil_coach_en_espace_coach()
     and public.acces_contenu(a.profil_client_id, a.profil_coach_id)
   order by 2;
$$;

create or replace function public.affecter_programme(
  p_programme_id uuid,
  p_profil_client_id uuid,
  p_debut date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes := public.mon_programme_verrouille(p_programme_id);
  v_aujourdhui date := (now() at time zone 'Europe/Paris')::date;
  v_creees integer;
begin
  if v_programme.statut <> 'publie' then
    raise exception 'transition_interdite';
  end if;
  if p_debut is null or p_debut < v_aujourdhui then
    raise exception 'date_invalide';
  end if;
  if not public.acces_contenu(p_profil_client_id, v_programme.profil_coach_id) then
    raise exception 'abonnement_sans_acces';
  end if;
  if exists (
    select 1 from public.seances_programmees
     where profil_client_id = p_profil_client_id
       and profil_coach_id = v_programme.profil_coach_id
       and date_prevue >= v_aujourdhui
       and statut in ('a_faire', 'en_cours')
  ) then
    raise exception 'programme_deja_en_cours';
  end if;
  insert into public.seances_programmees (
    seance_id, programme_id, profil_client_id, profil_coach_id, date_prevue
  )
  select s.id, v_programme.id, p_profil_client_id, v_programme.profil_coach_id,
         p_debut + s.jour_relatif - 1
    from public.seances s
   where s.programme_id = v_programme.id;
  get diagnostics v_creees = row_count;
  return v_creees;
end;
$$;

create or replace function public.mes_seances_du_jour()
returns table (
  id uuid,
  titre text,
  duree_minutes smallint,
  nombre_exercices integer,
  coach_prenom text,
  coach_nom text,
  statut public.seance_programmee_statut_enum
)
language sql
stable
security definer
set search_path = public
as $$
  select sp.id, s.titre, s.duree_minutes,
         (select count(*)::integer from public.exercices e where e.seance_id = s.id),
         pc.prenom, pc.nom, sp.statut
    from public.seances_programmees sp
    join public.seances s on s.id = sp.seance_id
    join public.profils_coach pc on pc.id = sp.profil_coach_id
   where sp.profil_client_id = public.mon_profil_client_en_espace_client()
     and sp.date_prevue = (now() at time zone 'Europe/Paris')::date
     and public.acces_contenu(sp.profil_client_id, sp.profil_coach_id)
   order by s.titre;
$$;

create or replace function public.ma_seance_programmee(p_seance_programmee_id uuid)
returns table (
  id uuid,
  titre text,
  duree_minutes smallint,
  date_prevue date,
  statut public.seance_programmee_statut_enum,
  demarree_le timestamptz,
  rattrapee boolean,
  coach_prenom text,
  coach_nom text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sp public.seances_programmees := public.ma_seance_programmee_verifiee(p_seance_programmee_id);
begin
  return query
  select v_sp.id, s.titre, s.duree_minutes, v_sp.date_prevue, v_sp.statut, v_sp.demarree_le,
         v_sp.rattrapee, pc.prenom, pc.nom
    from public.seances s
    join public.profils_coach pc on pc.id = v_sp.profil_coach_id
   where s.id = v_sp.seance_id;
end;
$$;

create or replace function public.exercices_de_ma_seance(p_seance_programmee_id uuid)
returns table (
  id uuid,
  ordre smallint,
  nom text,
  series smallint,
  repetitions smallint,
  charge_grammes integer,
  consigne text,
  media_chemin text,
  media_type_mime text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sp public.seances_programmees := public.ma_seance_programmee_verifiee(p_seance_programmee_id);
begin
  return query
  select e.id, e.ordre, e.nom, e.series, e.repetitions, e.charge_grammes, e.consigne,
         m.chemin, m.type_mime
    from public.exercices e
    left join public.medias m on m.id = e.media_id
   where e.seance_id = v_sp.seance_id
   order by e.ordre;
end;
$$;

-- Pour la politique de lecture de storage.objects : ce média sert-il une séance programmée du
-- client connecté, auquel il a accès ? Ne lève jamais : rend faux.
create or replace function public.media_lisible_par_client(p_chemin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.seances_programmees sp
      join public.profils_client pcl on pcl.id = sp.profil_client_id
      join public.exercices e on e.seance_id = sp.seance_id
      join public.medias m on m.id = e.media_id
     where pcl.compte_id = auth.uid()
       and m.chemin = p_chemin
       and public.acces_contenu(sp.profil_client_id, sp.profil_coach_id)
  );
$$;

-- Reprises de 0081 : « client actif » (§4.6, décision 5) et séance déjà programmée.
create or replace function public.mes_programmes()
returns table (
  id uuid,
  titre text,
  duree_semaines smallint,
  statut public.programme_statut_enum,
  nombre_seances integer,
  abonnes_en_cours integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.titre, p.duree_semaines, p.statut,
         (select count(*)::integer from public.seances s where s.programme_id = p.id),
         (select count(distinct sp.profil_client_id)::integer
            from public.seances_programmees sp
           where sp.programme_id = p.id
             and sp.date_prevue >= (now() at time zone 'Europe/Paris')::date
             and sp.statut in ('a_faire', 'en_cours'))
    from public.programmes p
   where p.profil_coach_id = public.mon_profil_coach_en_espace_coach()
   order by p.cree_le desc;
$$;

create or replace function public.revenir_en_edition(p_programme_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes := public.mon_programme_verrouille(p_programme_id);
begin
  if v_programme.statut <> 'publie' then
    raise exception 'transition_interdite';
  end if;
  if exists (
    select 1 from public.seances_programmees
     where programme_id = v_programme.id
       and date_prevue >= (now() at time zone 'Europe/Paris')::date
       and statut in ('a_faire', 'en_cours')
  ) then
    raise exception 'retour_edition_interdit';
  end if;
  update public.programmes set statut = 'brouillon' where id = v_programme.id;
end;
$$;

create or replace function public.supprimer_seance(p_seance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance public.seances := public.ma_seance_en_brouillon(p_seance_id);
begin
  if exists (select 1 from public.seances_programmees where seance_id = v_seance.id) then
    raise exception 'seance_utilisee';
  end if;
  delete from public.seances where id = v_seance.id;
end;
$$;

-- Droits redits (docs/backend.md §4). acces_contenu, mon_profil_client_en_espace_client et
-- ma_seance_programmee_verifiee sont internes ; media_lisible_par_client sert la politique de
-- storage.objects, appelée sous le rôle du compte.
revoke execute on function public.acces_contenu(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.mon_profil_client_en_espace_client()
  from public, anon, authenticated, service_role;
revoke execute on function public.ma_seance_programmee_verifiee(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.abonnes_affectables()
  from public, anon, authenticated, service_role;
grant execute on function public.abonnes_affectables() to authenticated;
revoke execute on function public.affecter_programme(uuid, uuid, date)
  from public, anon, authenticated, service_role;
grant execute on function public.affecter_programme(uuid, uuid, date) to authenticated;
revoke execute on function public.mes_seances_du_jour()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_seances_du_jour() to authenticated;
revoke execute on function public.ma_seance_programmee(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ma_seance_programmee(uuid) to authenticated;
revoke execute on function public.exercices_de_ma_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.exercices_de_ma_seance(uuid) to authenticated;
revoke execute on function public.media_lisible_par_client(text)
  from public, anon, authenticated, service_role;
grant execute on function public.media_lisible_par_client(text) to authenticated;
revoke execute on function public.mes_programmes()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_programmes() to authenticated;
revoke execute on function public.revenir_en_edition(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.revenir_en_edition(uuid) to authenticated;
revoke execute on function public.supprimer_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_seance(uuid) to authenticated;
