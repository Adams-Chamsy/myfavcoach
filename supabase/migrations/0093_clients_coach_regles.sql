-- L7, P7.3b — les règles des clients du coach (décor : 0092). docs/ecrans/L7-08-pilotage.md,
-- L7-09-clients.md, L7-10-fiche-client.md ; docs/domaine.md §5.2, §5.3 ; docs/prompts/L7.md
-- (décisions 1, 2, 6, 7, 8) ; plan P7.3b validé le 18 novembre 2026.
--
-- Toutes en espace coach (mon_profil_coach_en_espace_coach : refus profil_coach_requis), le coach
-- désigné par sa session. Le badge est calculé une seule fois (clients_du_coach) : la liste, son
-- filtre « À relancer » et « À traiter » du pilotage lisent la même requête.
--
-- AUCUNE DONNÉE DE SANTÉ (décision 1) : ces fonctions ne lisent ni ressenti_effort, ni
-- mesures_corporelles, ni les poids de profils_client (src/test/coach-sans-donnee-sante.test.ts).

-- « Mes clients » : abonnement actif, résiliation programmée, impayé, suspendu ou en pause.
create or replace function public.statut_client_actuel(p_statut public.abonnement_statut_enum)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_statut in ('actif', 'resiliation_programmee', 'impaye', 'suspendu', 'en_pause');
$$;
revoke execute on function public.statut_client_actuel(public.abonnement_statut_enum)
  from public, anon, authenticated, service_role;

-- Séances non rattrapées (docs/domaine.md §5.3) : manquées ou partielles de ce coach, dont
-- l'échéance de rattrapage de L6 est passée (date_prevue < J − 7, la règle de demarrer_seance),
-- prévues après le jour (Paris) de la dernière séance faite chez ce coach, hors jours sans accès.
create or replace function public.seances_non_rattrapees(p_client uuid, p_coach uuid, p_jour date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with derniere as (
    select max(coalesce((terminee_le at time zone 'Europe/Paris')::date, date_prevue)) as jour
      from public.seances_programmees
     where profil_client_id = p_client and profil_coach_id = p_coach and statut = 'faite'
  )
  select count(*)::integer
    from public.seances_programmees sp, derniere d
   where sp.profil_client_id = p_client
     and sp.profil_coach_id = p_coach
     and sp.statut in ('manquee', 'partielle')
     and sp.date_prevue < p_jour - 7
     and (d.jour is null or sp.date_prevue > d.jour)
     and not public.jour_sans_acces(p_client, p_coach, sp.date_prevue);
$$;
revoke execute on function public.seances_non_rattrapees(uuid, uuid, date)
  from public, anon, authenticated, service_role;

-- Les clients actuels d'un coach, un par client (son abonnement en cours le plus récent), avec
-- son badge (décision 2) : rang 1 paiement_ko (impayé, suspendu) ; rang 2 inactive, n séances
-- non rattrapées, seulement s'il a accès aujourd'hui (un client en pause n'est jamais relancé) ;
-- rang 3 nouveau (actif depuis moins de 14 jours, actif_depuis_le) ; rang 4 a_jour.
create or replace function public.clients_du_coach(p_coach uuid, p_jour date)
returns table (
  profil_client_id uuid,
  prenom text,
  nom text,
  offre text,
  statut public.abonnement_statut_enum,
  prix_centimes integer,
  debute_le timestamptz,
  pause_jusqu_le date,
  fin_acces_le date,
  badge text,
  badge_n integer,
  rang integer
)
language sql
stable
security definer
set search_path = public
as $$
  with en_cours as (
    select distinct on (a.profil_client_id) a.*
      from public.abonnements a
     where a.profil_coach_id = p_coach and public.statut_client_actuel(a.statut)
     order by a.profil_client_id, a.debute_le desc
  ),
  avec_retard as (
    select a.*,
           case when public.statut_donne_acces(a.statut)
                then public.seances_non_rattrapees(a.profil_client_id, p_coach, p_jour)
                else 0 end as retard
      from en_cours a
  )
  select a.profil_client_id, pc.prenom, pc.nom, o.titre, a.statut, a.prix_fige_centimes,
         a.debute_le, a.pause_jusqu_le, a.fin_acces_le,
         case when a.statut in ('impaye', 'suspendu') then 'paiement_ko'
              when a.retard > 0 then 'inactive'
              when (a.actif_depuis_le at time zone 'Europe/Paris')::date > p_jour - 14 then 'nouveau'
              else 'a_jour' end,
         case when a.statut not in ('impaye', 'suspendu') and a.retard > 0 then a.retard end,
         case when a.statut in ('impaye', 'suspendu') then 1
              when a.retard > 0 then 2
              when (a.actif_depuis_le at time zone 'Europe/Paris')::date > p_jour - 14 then 3
              else 4 end
    from avec_retard a
    join public.profils_client pc on pc.id = a.profil_client_id
    join public.offres o on o.id = a.offre_id;
$$;
revoke execute on function public.clients_du_coach(uuid, date)
  from public, anon, authenticated, service_role;

-- 'actuel', 'ancien' (aucun abonnement actuel chez ce coach, au moins un résilié) ou null.
create or replace function public.relation_client(p_coach uuid, p_client uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.abonnements
                  where profil_coach_id = p_coach and profil_client_id = p_client
                    and public.statut_client_actuel(statut)) then 'actuel'
    when exists (select 1 from public.abonnements
                  where profil_coach_id = p_coach and profil_client_id = p_client
                    and statut = 'resilie') then 'ancien'
  end;
$$;
revoke execute on function public.relation_client(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Semaine k de l'abonnement, depuis debute_le (docs/domaine.md §5.3).
create or replace function public.semaine_abonnement(p_debute_le timestamptz, p_jour date)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(1, (p_jour - (p_debute_le at time zone 'Europe/Paris')::date) / 7 + 1);
$$;
revoke execute on function public.semaine_abonnement(timestamptz, date)
  from public, anon, authenticated, service_role;

-- Le programme en cours d'un client chez ce coach (règle de 0085 : une séance à venir, à faire
-- ou en cours) : { id, titre, semaine, semaines } ou null.
create or replace function public.programme_en_cours(p_client uuid, p_coach uuid, p_jour date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with courant as (
    select sp.programme_id
      from public.seances_programmees sp
     where sp.profil_client_id = p_client and sp.profil_coach_id = p_coach
       and sp.date_prevue >= p_jour and sp.statut in ('a_faire', 'en_cours')
     order by sp.date_prevue
     limit 1
  )
  select jsonb_build_object(
           'id', p.id,
           'titre', p.titre,
           'semaine', least(p.duree_semaines::integer, greatest(1, (p_jour - (
             select min(date_prevue) from public.seances_programmees
              where programme_id = p.id and profil_client_id = p_client)) / 7 + 1)),
           'semaines', p.duree_semaines)
    from courant c join public.programmes p on p.id = c.programme_id;
$$;
revoke execute on function public.programme_en_cours(uuid, uuid, date)
  from public, anon, authenticated, service_role;

create or replace function public.mes_clients()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.mon_profil_coach_en_espace_coach();
  v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  return (
    with c as (select * from public.clients_du_coach(v_coach, v_jour))
    select jsonb_build_object(
      'clients', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'profil_client_id', c.profil_client_id,
                 'prenom', c.prenom,
                 'nom', c.nom,
                 'offre', c.offre,
                 'statut', c.statut,
                 'badge', c.badge,
                 'badge_n', c.badge_n,
                 'semaine', public.semaine_abonnement(c.debute_le, v_jour),
                 'semaine_en_cours',
                   public.metriques_seances(c.profil_client_id, v_coach, v_jour) -> 'semaines' -> 7,
                 'programme_en_cours',
                   public.programme_en_cours(c.profil_client_id, v_coach, v_jour) is not null,
                 'pause_jusqu_le', c.pause_jusqu_le,
                 'fin_acces_le', c.fin_acces_le)
               order by c.rang, lower(coalesce(c.nom, c.prenom)), lower(c.prenom), c.profil_client_id)
          from c), '[]'::jsonb),
      'compteurs', jsonb_build_object(
        'tous', (select count(*) from c),
        'a_relancer', (select count(*) from c where c.rang <= 2),
        'nouveaux', (select count(*) from c where c.badge = 'nouveau'),
        'anciens', (
          select count(distinct a.profil_client_id) from public.abonnements a
           where a.profil_coach_id = v_coach
             and public.relation_client(v_coach, a.profil_client_id) = 'ancien'))
    )
  );
end;
$$;
revoke execute on function public.mes_clients() from public, anon, authenticated, service_role;
grant execute on function public.mes_clients() to authenticated;

create or replace function public.mes_anciens_clients()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.mon_profil_coach_en_espace_coach();
begin
  return (
    with dernier as (
      select distinct on (a.profil_client_id) a.*
        from public.abonnements a
       where a.profil_coach_id = v_coach and a.statut = 'resilie'
         and public.relation_client(v_coach, a.profil_client_id) = 'ancien'
       order by a.profil_client_id, a.fin_acces_le desc, a.debute_le desc
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'profil_client_id', d.profil_client_id,
             'prenom', pc.prenom,
             'nom', pc.nom,
             'offre', o.titre,
             'debute_le', (d.debute_le at time zone 'Europe/Paris')::date,
             'fin_acces_le', d.fin_acces_le)
           order by d.fin_acces_le desc, lower(coalesce(pc.nom, pc.prenom)), d.profil_client_id),
           '[]'::jsonb)
      from dernier d
      join public.profils_client pc on pc.id = d.profil_client_id
      join public.offres o on o.id = d.offre_id
  );
end;
$$;
revoke execute on function public.mes_anciens_clients()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_anciens_clients() to authenticated;

-- Les séances passées de ce client chez ce coach, la plus récente d'abord, quinze au plus. Les
-- séances d'un jour sans accès non faites sont écartées, comme des métriques. p_ancien : seules
-- les séances réalisées (faite, partielle), sans commentaire (arbitrage en attente, L7-10).
create or replace function public.historique_seances_client(
  p_client uuid, p_coach uuid, p_jour date, p_ancien boolean
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(h.ligne order by h.date_prevue desc, h.id), '[]'::jsonb)
    from (
      select sp.id, sp.date_prevue,
             jsonb_build_object(
               'id', sp.id,
               'titre', s.titre,
               'date_prevue', sp.date_prevue,
               'duree_minutes', s.duree_minutes,
               'statut', sp.statut,
               'rattrapee', sp.rattrapee,
               'commentaire', case when p_ancien then null else sp.commentaire end) as ligne
        from public.seances_programmees sp
        join public.seances s on s.id = sp.seance_id
       where sp.profil_client_id = p_client and sp.profil_coach_id = p_coach
         and (sp.date_prevue < p_jour or sp.statut in ('faite', 'partielle'))
         and (not p_ancien or sp.statut in ('faite', 'partielle'))
         and (sp.statut in ('faite', 'partielle')
              or not public.jour_sans_acces(p_client, p_coach, sp.date_prevue))
       order by sp.date_prevue desc, sp.id
       limit 15
    ) h;
$$;
revoke execute on function public.historique_seances_client(uuid, uuid, date, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.fiche_client(p_profil_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.mon_profil_coach_en_espace_coach();
  v_jour date := (now() at time zone 'Europe/Paris')::date;
  v_relation text := public.relation_client(v_coach, p_profil_client_id);
  v_metriques jsonb;
  v_resultat jsonb;
begin
  if v_relation is null then
    raise exception 'client_introuvable';
  end if;
  v_metriques := public.metriques_seances(p_profil_client_id, v_coach, v_jour);

  if v_relation = 'ancien' then
    select jsonb_build_object(
             'mode', 'ancien',
             'profil_client_id', p_profil_client_id,
             'prenom', pc.prenom,
             'nom', pc.nom,
             'offre', o.titre,
             'debute_le', (a.debute_le at time zone 'Europe/Paris')::date,
             'fin_acces_le', a.fin_acces_le,
             'seances_faites', v_metriques -> 'seances_faites',
             'historique',
               public.historique_seances_client(p_profil_client_id, v_coach, v_jour, true))
      into v_resultat
      from public.abonnements a
      join public.profils_client pc on pc.id = a.profil_client_id
      join public.offres o on o.id = a.offre_id
     where a.profil_coach_id = v_coach and a.profil_client_id = p_profil_client_id
       and a.statut = 'resilie'
     order by a.fin_acces_le desc, a.debute_le desc
     limit 1;
    return v_resultat;
  end if;

  select jsonb_build_object(
           'mode', 'actuel',
           'profil_client_id', c.profil_client_id,
           'prenom', c.prenom,
           'nom', c.nom,
           'offre', c.offre,
           'statut', c.statut,
           'prix_centimes', c.prix_centimes,
           'debute_le', (c.debute_le at time zone 'Europe/Paris')::date,
           'badge', c.badge,
           'badge_n', c.badge_n,
           'derniere_seance_le', (
             select max(coalesce((terminee_le at time zone 'Europe/Paris')::date, date_prevue))
               from public.seances_programmees
              where profil_client_id = c.profil_client_id and profil_coach_id = v_coach
                and statut = 'faite'),
           'seances_faites', v_metriques -> 'seances_faites',
           'assiduite', v_metriques -> 'assiduite',
           'semaines', v_metriques -> 'semaines',
           'programme', public.programme_en_cours(c.profil_client_id, v_coach, v_jour),
           'historique',
             public.historique_seances_client(c.profil_client_id, v_coach, v_jour, false),
           'notes', (
             select n.texte from public.notes_clients n
              where n.profil_coach_id = v_coach and n.profil_client_id = c.profil_client_id))
    into v_resultat
    from public.clients_du_coach(v_coach, v_jour) c
   where c.profil_client_id = p_profil_client_id;
  return v_resultat;
end;
$$;
revoke execute on function public.fiche_client(uuid) from public, anon, authenticated, service_role;
grant execute on function public.fiche_client(uuid) to authenticated;

-- Refus : client_introuvable (pas un client de ce coach), client_ancien (lecture seule),
-- notes_invalides (absentes ou plus de 2 000 caractères). Un texte vide (espaces compris)
-- efface la note. Le texte n'est jamais journalisé (L7-10).
create or replace function public.enregistrer_notes_client(p_profil_client_id uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.mon_profil_coach_en_espace_coach();
  v_relation text := public.relation_client(v_coach, p_profil_client_id);
begin
  if v_relation is null then
    raise exception 'client_introuvable';
  end if;
  if v_relation = 'ancien' then
    raise exception 'client_ancien';
  end if;
  if p_texte is null or length(p_texte) > 2000 then
    raise exception 'notes_invalides';
  end if;
  if btrim(p_texte) = '' then
    delete from public.notes_clients
     where profil_coach_id = v_coach and profil_client_id = p_profil_client_id;
    return;
  end if;
  insert into public.notes_clients (profil_coach_id, profil_client_id, texte)
  values (v_coach, p_profil_client_id, p_texte)
  on conflict (profil_coach_id, profil_client_id)
  do update set texte = excluded.texte, modifiee_le = now();
end;
$$;
revoke execute on function public.enregistrer_notes_client(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_notes_client(uuid, text) to authenticated;

-- Le pilotage, sans le revenu (l'écran lit mes_revenus, L5 : une seule définition du net).
-- clients_avec_acces : actif, résiliation programmée, impayé. assiduite_moyenne : moyenne des
-- assiduités non nulles de ses clients actuels, arrondie. a_traiter : badges paiement_ko et
-- inactive (la règle du filtre « À relancer »), cinq au plus, dans l'ordre de la liste.
create or replace function public.mon_pilotage()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coach uuid := public.mon_profil_coach_en_espace_coach();
  v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  return (
    with c as (
      select x.*,
             (public.metriques_seances(x.profil_client_id, v_coach, v_jour) ->> 'assiduite')::numeric
               as assiduite
        from public.clients_du_coach(v_coach, v_jour) x
    ),
    a_traiter as (
      select * from c where c.rang <= 2
    )
    select jsonb_build_object(
      'aucun_client', not exists (select 1 from c),
      'clients_avec_acces', (select count(*) from c where public.statut_donne_acces(c.statut)),
      'assiduite_moyenne', (select round(avg(c.assiduite))::integer from c),
      'a_traiter_total', (select count(*) from a_traiter),
      'a_traiter', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'profil_client_id', t.profil_client_id,
                 'prenom', t.prenom,
                 'nom', t.nom,
                 'badge', t.badge,
                 'badge_n', t.badge_n) order by t.ordre)
          from (
            select a.*, row_number() over (
                     order by a.rang, lower(coalesce(a.nom, a.prenom)), lower(a.prenom),
                              a.profil_client_id) as ordre
              from a_traiter a
          ) t
         where t.ordre <= 5), '[]'::jsonb)
    )
  );
end;
$$;
revoke execute on function public.mon_pilotage() from public, anon, authenticated, service_role;
grant execute on function public.mon_pilotage() to authenticated;
