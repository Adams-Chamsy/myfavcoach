-- Soumission du dossier de vérification -- RÈGLE (2 novembre 2026, A1). Décor : 0052.
--
-- Décisions du développeur, le même jour :
--   - la soumission est AUTOMATIQUE, dès que les trois pièces sont déposées : un coach qui ferme
--     l'application ne reste jamais « absent » avec un dossier complet ;
--   - un délai pour l'ensemble du dossier (docs/domaine.md §4.2) : dossier_soumis_le est posé à
--     la soumission, et ne bouge plus ni au remplacement d'une pièce pendant l'examen, ni au
--     retour d'un complément ;
--   - un dossier refusé ou révoqué ne repart en examen qu'une fois les TROIS pièces redéposées
--     après la décision : un seul document ne relance pas l'examen d'un dossier incomplet.
--
-- Le manque était écrit dès P2.6, dans l'en-tête de 0015 (« un mécanisme séparé... non
-- construit »), et n'avait jamais rejoint docs/dette.md : un trou documenté au mauvais endroit
-- est un trou perdu.

-- La liste des types est fermée (docs/domaine.md §4.2) : la règle ci-dessous compte des types,
-- un type inconnu fausserait ce compte. Vérifié sur le projet de développement avant d'écrire
-- cette contrainte : trois pièces, des trois types connus (2 novembre 2026).
alter table public.pieces_verification
  add constraint pieces_verification_type_connu
  check (type in ('identite', 'diplome_ou_certification', 'assurance_rc_pro'));

-- SECURITY DEFINER : le coach dépose sa pièce avec ses propres droits, mais
-- profils_coach.statut_verification et dossier_soumis_le n'ont aucun grant UPDATE pour lui, et
-- decisions_verification aucun grant du tout (0015). Agit seulement sur le coach de la pièce
-- déposée (new.coach_id), dont la politique d'INSERT de pieces_verification a déjà vérifié
-- qu'il appartient à l'appelant (0012).
create or replace function public.soumettre_dossier_si_complet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut public.statut_verification_enum;
  v_derniere_decision timestamptz;
  v_types integer;
begin
  select statut_verification into v_statut
  from public.profils_coach
  where id = new.coach_id
  for update;

  if v_statut = 'absente' then
    select count(distinct type) into v_types
    from public.pieces_verification
    where coach_id = new.coach_id;
    if v_types = 3 then
      update public.profils_coach
         set statut_verification = 'en_examen', dossier_soumis_le = now()
       where id = new.coach_id;
    end if;

  elsif v_statut = 'complement_demande' then
    -- « pièce fournie » (docs/domaine.md §4.2) : la date de soumission ne bouge pas.
    update public.profils_coach
       set statut_verification = 'en_examen'
     where id = new.coach_id;

  elsif v_statut in ('refusee', 'revoquee') then
    -- « nouveau dossier » : les trois types, déposés APRÈS la dernière décision.
    select max(horodatage) into v_derniere_decision
    from public.decisions_verification
    where dossier = new.coach_id;
    select count(distinct type) into v_types
    from public.pieces_verification
    where coach_id = new.coach_id
      and depose_le > coalesce(v_derniere_decision, '-infinity'::timestamptz);
    if v_types = 3 then
      update public.profils_coach
         set statut_verification = 'en_examen', dossier_soumis_le = now()
       where id = new.coach_id;
    end if;
  end if;
  -- en_examen (remplacement d'une pièce pendant l'examen) et verifiee : rien ne change.

  return new;
end;
$$;

revoke execute on function public.soumettre_dossier_si_complet()
  from public, anon, authenticated, service_role;

create or replace function public.mon_dossier_verification()
returns table (statut public.statut_verification_enum, soumis_le timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select statut_verification, dossier_soumis_le
  from public.profils_coach
  where compte_id = auth.uid();
$$;

revoke execute on function public.mon_dossier_verification()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_dossier_verification() to authenticated;

-- Rattrapage, une fois : un dossier « absent » déjà complet est passé en examen, daté du moment
-- où sa troisième pièce est arrivée (le plus tardif des premiers dépôts de chaque type). C'est
-- ce que la règle aurait fait si elle avait existé. Sur le projet de développement, un dossier
-- est concerné (le coach de la séance d'essais du 2 novembre 2026).
update public.profils_coach pc
   set statut_verification = 'en_examen',
       dossier_soumis_le = (
         select max(premier_depot)
         from (
           select min(depose_le) as premier_depot
           from public.pieces_verification
           where coach_id = pc.id
           group by type
         ) premiers
       )
 where pc.statut_verification = 'absente'
   and (select count(distinct type) from public.pieces_verification where coach_id = pc.id) = 3;
