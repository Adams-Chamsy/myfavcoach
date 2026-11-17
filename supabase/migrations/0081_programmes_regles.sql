-- L6, P6.2 — les règles des programmes, séances et exercices (décor : 0080). docs/domaine.md
-- §3.6 et §4.6 ; docs/prompts/L6.md ; docs/ecrans/L6-11-studio.md.
--
-- Tout passe par ces fonctions, en espace coach (mon_profil_coach_en_espace_coach, 0069 : refus
-- profil_coach_requis). Un programme d'un autre coach : programme_introuvable, la même réponse
-- qu'un programme qui n'existe pas. Seul un brouillon se modifie (programme_non_modifiable).
-- « Client actif » (§4.6) arrive en P6.4, avec les séances programmées : d'ici là, aucun.

-- Le programme du coach connecté, verrouillé ; refus s'il n'est pas à lui.
create or replace function public.mon_programme_verrouille(p_programme_id uuid)
returns public.programmes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.mon_profil_coach_en_espace_coach();
  v_programme public.programmes;
begin
  select * into v_programme from public.programmes
   where id = p_programme_id and profil_coach_id = v_coach
   for update;
  if v_programme.id is null then
    raise exception 'programme_introuvable';
  end if;
  return v_programme;
end;
$$;

create or replace function public.mon_brouillon_verrouille(p_programme_id uuid)
returns public.programmes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes := public.mon_programme_verrouille(p_programme_id);
begin
  if v_programme.statut <> 'brouillon' then
    raise exception 'programme_non_modifiable';
  end if;
  return v_programme;
end;
$$;

-- La séance du coach connecté, avec son programme en brouillon (pour l'écrire).
create or replace function public.ma_seance_en_brouillon(p_seance_id uuid)
returns public.seances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance public.seances;
begin
  select s.* into v_seance from public.seances s
    join public.programmes p on p.id = s.programme_id
   where s.id = p_seance_id
     and p.profil_coach_id = public.mon_profil_coach_en_espace_coach();
  if v_seance.id is null then
    raise exception 'seance_introuvable';
  end if;
  perform public.mon_brouillon_verrouille(v_seance.programme_id);
  return v_seance;
end;
$$;

create or replace function public.creer_programme()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.programmes (profil_coach_id)
  values (public.mon_profil_coach_en_espace_coach())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.modifier_programme(
  p_programme_id uuid,
  p_titre text,
  p_duree_semaines smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes := public.mon_brouillon_verrouille(p_programme_id);
begin
  if p_duree_semaines is null or p_duree_semaines < 1 or p_duree_semaines > 12
     or p_titre is null or length(p_titre) > 80 then
    raise exception 'programme_invalide';
  end if;
  if exists (
    select 1 from public.seances
     where programme_id = v_programme.id and jour_relatif > p_duree_semaines * 7
  ) then
    raise exception 'duree_trop_courte';
  end if;
  update public.programmes
     set titre = btrim(p_titre), duree_semaines = p_duree_semaines
   where id = v_programme.id;
end;
$$;

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
         0
    from public.programmes p
   where p.profil_coach_id = public.mon_profil_coach_en_espace_coach()
   order by p.cree_le desc;
$$;

create or replace function public.seances_du_programme(p_programme_id uuid)
returns table (
  id uuid,
  titre text,
  duree_minutes smallint,
  jour_relatif smallint,
  nombre_exercices integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.programmes p
     where p.id = p_programme_id
       and p.profil_coach_id = public.mon_profil_coach_en_espace_coach()
  ) then
    raise exception 'programme_introuvable';
  end if;
  return query
  select s.id, s.titre, s.duree_minutes, s.jour_relatif,
         (select count(*)::integer from public.exercices e where e.seance_id = s.id)
    from public.seances s
   where s.programme_id = p_programme_id
   order by s.jour_relatif, s.cree_le;
end;
$$;

create or replace function public.exercices_de_la_seance(p_seance_id uuid)
returns table (
  id uuid,
  ordre smallint,
  nom text,
  series smallint,
  repetitions smallint,
  charge_grammes integer,
  consigne text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.seances s
      join public.programmes p on p.id = s.programme_id
     where s.id = p_seance_id
       and p.profil_coach_id = public.mon_profil_coach_en_espace_coach()
  ) then
    raise exception 'seance_introuvable';
  end if;
  return query
  select e.id, e.ordre, e.nom, e.series, e.repetitions, e.charge_grammes, e.consigne
    from public.exercices e
   where e.seance_id = p_seance_id
   order by e.ordre;
end;
$$;

create or replace function public.ajouter_seance(p_programme_id uuid, p_jour_relatif smallint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes := public.mon_brouillon_verrouille(p_programme_id);
  v_id uuid;
begin
  if p_jour_relatif is null or p_jour_relatif < 1
     or p_jour_relatif > v_programme.duree_semaines * 7 then
    raise exception 'jour_hors_programme';
  end if;
  insert into public.seances (programme_id, jour_relatif)
  values (v_programme.id, p_jour_relatif)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.modifier_seance(
  p_seance_id uuid,
  p_titre text,
  p_duree_minutes smallint,
  p_jour_relatif smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance public.seances := public.ma_seance_en_brouillon(p_seance_id);
  v_duree_semaines smallint;
begin
  select duree_semaines into v_duree_semaines from public.programmes
   where id = v_seance.programme_id;
  if p_jour_relatif is null or p_jour_relatif < 1 or p_jour_relatif > v_duree_semaines * 7 then
    raise exception 'jour_hors_programme';
  end if;
  if p_titre is null or length(p_titre) > 80
     or p_duree_minutes is null or p_duree_minutes < 1 or p_duree_minutes > 300 then
    raise exception 'seance_invalide';
  end if;
  update public.seances
     set titre = btrim(p_titre), duree_minutes = p_duree_minutes, jour_relatif = p_jour_relatif
   where id = v_seance.id;
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
  delete from public.seances where id = v_seance.id;
end;
$$;

-- Copie les séances de la semaine p_semaine (et leurs exercices) dans la semaine suivante.
create or replace function public.dupliquer_semaine(p_programme_id uuid, p_semaine smallint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes := public.mon_brouillon_verrouille(p_programme_id);
  v_seance public.seances;
  v_nouvelle uuid;
  v_copiees integer := 0;
begin
  if p_semaine is null or p_semaine < 1 or p_semaine >= v_programme.duree_semaines then
    raise exception 'jour_hors_programme';
  end if;
  for v_seance in
    select * from public.seances
     where programme_id = v_programme.id
       and jour_relatif between (p_semaine - 1) * 7 + 1 and p_semaine * 7
     order by jour_relatif, cree_le
  loop
    insert into public.seances (programme_id, titre, duree_minutes, jour_relatif)
    values (v_programme.id, v_seance.titre, v_seance.duree_minutes, v_seance.jour_relatif + 7)
    returning id into v_nouvelle;
    insert into public.exercices (seance_id, ordre, nom, series, repetitions, charge_grammes,
                                  consigne)
    select v_nouvelle, ordre, nom, series, repetitions, charge_grammes, consigne
      from public.exercices where seance_id = v_seance.id;
    v_copiees := v_copiees + 1;
  end loop;
  return v_copiees;
end;
$$;

create or replace function public.ajouter_exercice(
  p_seance_id uuid,
  p_nom text,
  p_series smallint,
  p_repetitions smallint,
  p_charge_grammes integer,
  p_consigne text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance public.seances := public.ma_seance_en_brouillon(p_seance_id);
  v_id uuid;
begin
  if p_nom is null or btrim(p_nom) = '' or length(p_nom) > 80
     or (p_series is not null and (p_series < 1 or p_series > 20))
     or (p_repetitions is not null and (p_repetitions < 1 or p_repetitions > 200))
     or (p_charge_grammes is not null and (p_charge_grammes < 0 or p_charge_grammes > 500000))
     or length(coalesce(p_consigne, '')) > 500 then
    raise exception 'exercice_invalide';
  end if;
  insert into public.exercices (seance_id, ordre, nom, series, repetitions, charge_grammes,
                                consigne)
  values (
    v_seance.id,
    coalesce((select max(ordre) from public.exercices where seance_id = v_seance.id), 0) + 1,
    btrim(p_nom), p_series, p_repetitions, p_charge_grammes, coalesce(btrim(p_consigne), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.supprimer_exercice(p_exercice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance_id uuid;
begin
  select seance_id into v_seance_id from public.exercices where id = p_exercice_id;
  if v_seance_id is null then
    raise exception 'exercice_introuvable';
  end if;
  perform public.ma_seance_en_brouillon(v_seance_id);
  delete from public.exercices where id = p_exercice_id;
end;
$$;

-- Échange l'exercice avec son voisin du dessus ('haut') ou du dessous ('bas'). Sans voisin :
-- rien ne bouge.
create or replace function public.deplacer_exercice(p_exercice_id uuid, p_sens text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exercice public.exercices;
  v_voisin public.exercices;
begin
  select * into v_exercice from public.exercices where id = p_exercice_id;
  if v_exercice.id is null then
    raise exception 'exercice_introuvable';
  end if;
  perform public.ma_seance_en_brouillon(v_exercice.seance_id);
  if p_sens = 'haut' then
    select * into v_voisin from public.exercices
     where seance_id = v_exercice.seance_id and ordre < v_exercice.ordre
     order by ordre desc limit 1;
  elsif p_sens = 'bas' then
    select * into v_voisin from public.exercices
     where seance_id = v_exercice.seance_id and ordre > v_exercice.ordre
     order by ordre limit 1;
  else
    raise exception 'exercice_invalide';
  end if;
  if v_voisin.id is null then
    return;
  end if;
  update public.exercices set ordre = v_voisin.ordre where id = v_exercice.id;
  update public.exercices set ordre = v_exercice.ordre where id = v_voisin.id;
end;
$$;

create or replace function public.publier_programme(p_programme_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programme public.programmes := public.mon_brouillon_verrouille(p_programme_id);
begin
  if not exists (
    select 1 from public.profils_coach
     where id = v_programme.profil_coach_id and statut_verification = 'verifiee'
  ) then
    raise exception 'identite_non_verifiee';
  end if;
  if not exists (select 1 from public.seances where programme_id = v_programme.id) then
    raise exception 'programme_vide';
  end if;
  update public.programmes set statut = 'publie', publie_le = now() where id = v_programme.id;
end;
$$;

create or replace function public.archiver_programme(p_programme_id uuid)
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
  update public.programmes set statut = 'archive', archive_le = now() where id = v_programme.id;
end;
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
  update public.programmes set statut = 'brouillon' where id = v_programme.id;
end;
$$;

-- Droits redits (docs/backend.md §4) : les trois assistants internes ne sont appelables par
-- aucun rôle de l'application ; les autres, par un compte connecté (le refus d'espace est dans
-- la fonction).
revoke execute on function public.mon_programme_verrouille(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.mon_brouillon_verrouille(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.ma_seance_en_brouillon(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.creer_programme()
  from public, anon, authenticated, service_role;
grant execute on function public.creer_programme() to authenticated;
revoke execute on function public.modifier_programme(uuid, text, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.modifier_programme(uuid, text, smallint) to authenticated;
revoke execute on function public.mes_programmes()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_programmes() to authenticated;
revoke execute on function public.seances_du_programme(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.seances_du_programme(uuid) to authenticated;
revoke execute on function public.exercices_de_la_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.exercices_de_la_seance(uuid) to authenticated;
revoke execute on function public.ajouter_seance(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.ajouter_seance(uuid, smallint) to authenticated;
revoke execute on function public.modifier_seance(uuid, text, smallint, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.modifier_seance(uuid, text, smallint, smallint) to authenticated;
revoke execute on function public.supprimer_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_seance(uuid) to authenticated;
revoke execute on function public.dupliquer_semaine(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.dupliquer_semaine(uuid, smallint) to authenticated;
revoke execute on function public.ajouter_exercice(uuid, text, smallint, smallint, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.ajouter_exercice(uuid, text, smallint, smallint, integer, text) to authenticated;
revoke execute on function public.supprimer_exercice(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_exercice(uuid) to authenticated;
revoke execute on function public.deplacer_exercice(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.deplacer_exercice(uuid, text) to authenticated;
revoke execute on function public.publier_programme(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.publier_programme(uuid) to authenticated;
revoke execute on function public.archiver_programme(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.archiver_programme(uuid) to authenticated;
revoke execute on function public.revenir_en_edition(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.revenir_en_edition(uuid) to authenticated;
