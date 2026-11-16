-- Solde et versements du coach -- RÈGLES (16 novembre 2026, L5, P5.4 ; décor : 0073 ;
-- docs/domaine.md §3.10, §4.8 ; docs/prompts/L5.md, décision 5).
--
--   - Un versement exige un compte de versement opérationnel (§3.3, §4.8).
--   - Jamais en dessous de 20 € de solde (2 000 centimes).
--   - Un seul versement prévu ou en cours par coach à la fois.
--   - Immédiat : tout le solde, moins 1 € de frais. Mensuel : tout le solde, sans frais, le 5 du
--     mois seulement (jour de Paris), créé par la tâche quotidienne.
--
-- Refus du coach : solde_insuffisant, compte_versement_non_operationnel, versement_deja_en_cours.

create or replace function public.demander_versement_immediat()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_coach_en_espace_coach();
  v_solde integer;
  v_id uuid;
begin
  -- Verrou sur le compte de versement du coach : deux demandes simultanées ne créent jamais
  -- deux versements.
  perform 1 from public.comptes_versement_coach where profil_coach_id = v_profil for update;
  if not public.compte_versement_operationnel(v_profil) then
    raise exception 'compte_versement_non_operationnel';
  end if;
  if exists (
    select 1 from public.versements
     where profil_coach_id = v_profil and statut in ('prevu', 'en_cours')
  ) then
    raise exception 'versement_deja_en_cours';
  end if;
  v_solde := public.solde_coach(v_profil);
  if v_solde < 2000 then
    raise exception 'solde_insuffisant';
  end if;
  insert into public.versements (profil_coach_id, montant_centimes, frais_centimes, mode)
  values (v_profil, v_solde - 100, 100, 'immediat')
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.demander_versement_immediat()
  from public, anon, authenticated, service_role;
grant execute on function public.demander_versement_immediat() to authenticated;

create or replace function public.creer_versements_mensuels(
  p_jour date,
  p_profil_coach_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crees integer;
begin
  if extract(day from p_jour) <> 5 then
    return 0;
  end if;
  insert into public.versements (profil_coach_id, montant_centimes, frais_centimes, mode)
  select c.profil_coach_id, public.solde_coach(c.profil_coach_id), 0, 'mensuel'
    from public.comptes_versement_coach c
   where (p_profil_coach_id is null or c.profil_coach_id = p_profil_coach_id)
     and c.etat = 'operationnel'
     and public.solde_coach(c.profil_coach_id) >= 2000
     and not exists (
       select 1 from public.versements v
        where v.profil_coach_id = c.profil_coach_id and v.statut in ('prevu', 'en_cours')
     );
  get diagnostics v_crees = row_count;
  return v_crees;
end;
$$;

revoke execute on function public.creer_versements_mensuels(date, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_versements_mensuels(date, uuid) to service_role;
