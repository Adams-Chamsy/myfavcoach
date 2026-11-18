-- L7, P7.3a — les règles du suivi (décor : 0090). docs/domaine.md §5.2, §5.3 ;
-- docs/ecrans/L7-06-suivi.md ; revue du développeur du 18 novembre 2026.
--
-- 1. Un déclencheur sur abonnements écrit chaque statut dans historique_statuts_abonnement. Un
--    déclencheur plutôt qu'un appel dans chaque fonction : une dizaine de migrations changent le
--    statut d'un abonnement (webhooks, pause, tâche du matin, suppression de compte...).
-- 2. jour_sans_acces : le client n'avait accès au contenu de ce coach à AUCUN moment de ce jour
--    (Europe/Paris). Avant le premier statut connu du couple, on ne sait pas : la séance compte,
--    comme avant (l'historique ancien reste tel quel).
-- 3. metriques_seances : séances faites, assiduité, huit semaines, série, sur les séances
--    retenues. Partagée avec la vue du coach (P7.3b, p_coach renseigné). Aucune donnée de santé.
-- 4. mon_suivi : le client, en espace client, sur les coachs auxquels il a accès aujourd'hui.

-- La règle de acces_contenu (0085), pour un statut seul. Les deux doivent rester identiques.
create or replace function public.statut_donne_acces(p_statut public.abonnement_statut_enum)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_statut in ('actif', 'resiliation_programmee', 'impaye');
$$;
revoke execute on function public.statut_donne_acces(public.abonnement_statut_enum)
  from public, anon, authenticated, service_role;

create or replace function public.noter_statut_abonnement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.statut is distinct from old.statut then
    insert into public.historique_statuts_abonnement (abonnement_id, statut)
    values (new.id, new.statut);
  end if;
  return null;
end;
$$;
revoke execute on function public.noter_statut_abonnement()
  from public, anon, authenticated, service_role;

create trigger abonnements_noter_statut
  after insert or update of statut on public.abonnements
  for each row execute function public.noter_statut_abonnement();

-- Amorçage : le statut courant de chaque abonnement existant, daté d'aujourd'hui. Les jours
-- d'avant restent « inconnus » : leurs séances comptent, comme avant cette migration.
insert into public.historique_statuts_abonnement (abonnement_id, statut)
select id, statut from public.abonnements;

-- Le lundi de la semaine d'un jour (semaine lundi–dimanche, docs/domaine.md §5.3).
create or replace function public.lundi_de(p_jour date)
returns date
language sql
immutable
set search_path = public
as $$
  select p_jour - (extract(isodow from p_jour)::integer - 1);
$$;
revoke execute on function public.lundi_de(date) from public, anon, authenticated, service_role;

-- Vrai si l'historique du couple client–coach est connu pour ce jour et qu'aucun de ses
-- abonnements n'a donné accès à un moment quelconque du jour (Paris). Un client qui reprend à
-- 10 h pouvait faire sa séance l'après-midi : le jour compte.
create or replace function public.jour_sans_acces(p_client uuid, p_coach uuid, p_jour date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with bornes as (
    select (p_jour::timestamp at time zone 'Europe/Paris') as debut,
           ((p_jour + 1)::timestamp at time zone 'Europe/Paris') as fin
  ),
  historique as (
    select h.id, h.abonnement_id, h.statut, h.depuis
      from public.historique_statuts_abonnement h
      join public.abonnements a on a.id = h.abonnement_id
     where a.profil_client_id = p_client and a.profil_coach_id = p_coach
  )
  select exists (select 1 from historique h, bornes b where h.depuis < b.fin)
     and not exists (
       select 1
         from bornes b, (select distinct abonnement_id from historique) x
        where public.statut_donne_acces((
                select h.statut from historique h
                 where h.abonnement_id = x.abonnement_id and h.depuis <= b.debut
                 order by h.depuis desc, h.id desc
                 limit 1))
           or exists (
                select 1 from historique h
                 where h.abonnement_id = x.abonnement_id
                   and h.depuis > b.debut and h.depuis < b.fin
                   and public.statut_donne_acces(h.statut))
     );
$$;
revoke execute on function public.jour_sans_acces(uuid, uuid, date)
  from public, anon, authenticated, service_role;

-- p_coach null : les coachs auxquels le client a accès aujourd'hui (vue du client) ; sinon ce
-- coach seul (vue du coach). Une séance d'un jour sans accès est écartée, sauf si le client l'a
-- faite quand même (rattrapée après sa reprise, par exemple).
--   seances_faites : statut faite, rattrapées comprises, depuis le début ;
--   depuis         : la première séance retenue ;
--   assiduite      : du jour J−28 à J−1, faite 1, partielle 0,5, sinon 0 ; null sous 4 séances ;
--   semaines       : huit, la plus ancienne d'abord ; faites = statut faite (entier), prevues ;
--   serie          : semaines terminées en remontant depuis la dernière : au moins une faite
--                    → +1 ; aucune faite mais une partielle, ou aucune séance retenue → conservée ;
--                    séances retenues, aucune faite ni partielle → interrompue. La semaine en
--                    cours ajoute 1 si elle a une séance faite, n'interrompt jamais.
create or replace function public.metriques_seances(p_client uuid, p_coach uuid, p_jour date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with retenues as (
    select sp.date_prevue, sp.statut, public.lundi_de(sp.date_prevue) as lundi
      from public.seances_programmees sp
     where sp.profil_client_id = p_client
       and case when p_coach is null
                then public.acces_contenu(p_client, sp.profil_coach_id)
                else sp.profil_coach_id = p_coach end
       and (sp.statut in ('faite', 'partielle')
            or not public.jour_sans_acces(p_client, sp.profil_coach_id, sp.date_prevue))
  ),
  totaux as (
    select count(*) filter (where statut = 'faite') as faites, min(date_prevue) as depuis
      from retenues
  ),
  assiduite as (
    select count(*) as prevues,
           sum(case statut when 'faite' then 1.0 when 'partielle' then 0.5 else 0 end) as faites
      from retenues
     where date_prevue between p_jour - 28 and p_jour - 1
  ),
  par_semaine as (
    select lundi,
           count(*) filter (where statut = 'faite') as faites,
           count(*) filter (where statut = 'partielle') as partielles,
           count(*) as prevues
      from retenues
     group by lundi
  ),
  semaines as (
    select (public.lundi_de(p_jour) - 7 * k) as lundi from generate_series(0, 7) as k
  ),
  rupture as (
    select max(lundi) as lundi
      from par_semaine
     where lundi < public.lundi_de(p_jour) and faites = 0 and partielles = 0 and prevues > 0
  ),
  serie as (
    select count(*) filter (
             where p.lundi < public.lundi_de(p_jour)
               and p.lundi > coalesce(r.lundi, '-infinity'::date)
               and p.faites > 0)
         + count(*) filter (where p.lundi = public.lundi_de(p_jour) and p.faites > 0) as n
      from par_semaine p, rupture r
  )
  select jsonb_build_object(
    'seances_faites', t.faites,
    'depuis', t.depuis,
    'assiduite', case when a.prevues < 4 then null
                      else round(100 * a.faites / a.prevues)::integer end,
    'serie', s.n,
    'semaines', (
      select jsonb_agg(jsonb_build_object(
               'lundi', w.lundi,
               'faites', coalesce(p.faites, 0),
               'prevues', coalesce(p.prevues, 0)) order by w.lundi)
        from semaines w left join par_semaine p on p.lundi = w.lundi
    )
  )
  from totaux t, assiduite a, serie s;
$$;
revoke execute on function public.metriques_seances(uuid, uuid, date)
  from public, anon, authenticated, service_role;

create or replace function public.mon_suivi()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_client_en_espace_client();
begin
  return public.metriques_seances(v_profil, null, (now() at time zone 'Europe/Paris')::date);
end;
$$;
revoke execute on function public.mon_suivi() from public, anon, authenticated, service_role;
grant execute on function public.mon_suivi() to authenticated;
