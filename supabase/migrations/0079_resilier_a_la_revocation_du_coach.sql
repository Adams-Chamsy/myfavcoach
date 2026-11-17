-- L5, porte de sortie (17 novembre 2026) — un coach RÉVOQUÉ par la plateforme a les mêmes
-- effets sur ses abonnés qu'un coach qui supprime son compte (0068). docs/dette.md, « Abonnement
-- SEPA en en_attente_confirmation dont le coach est révoqué avant la confirmation de la banque » :
-- échéance L5, « avec les autres effets d'une révocation sur les abonnements existants ».
--
-- Décidé seul sous le mandat du 15 novembre (docs/decisions-en-attente.md), l'option la plus
-- simple et la plus réversible : réutiliser le filet du matin de 0068, qui tourne AVANT les
-- prélèvements. Donc, au plus tard le lendemain matin de la révocation, et toujours avant toute
-- nouvelle échéance :
--   actif                         -> resiliation_programmee, fin d'accès à la fin de la période
--                                    payée, aucun remboursement au prorata ;
--   en_pause | impaye | suspendu  -> resilie, le jour même ;
--   en_attente_confirmation       -> inchangé ; confirmé ensuite, programmé au filet suivant ;
--   offres publiées               -> retirées.
-- Une résiliation programmée ainsi ne s'annule pas (annuler_resiliation). Le solde déjà acquis
-- du coach n'est pas touché ici : ce qu'il a encaissé reste versable (docs/domaine.md §3.10).
-- Une levée de révocation (retour à 'verifiee') ne rétablit rien : les abonnés se réabonnent.
--
-- Les deux fonctions sont reprises à l'identique de 0068, avec la seule condition ajoutée ; leurs
-- droits aussi.

create or replace function public.resilier_abonnements_des_comptes_supprimes(
  p_jour date default (now() at time zone 'Europe/Paris')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_programmes integer;
  v_resilies integer;
begin
  -- Les offres publiées d'un coach supprimé, ou révoqué (0079), sont retirées : plus aucune souscription possible
  -- (creer_intention_souscription rend offre_indisponible).
  update public.offres o
     set retiree_le = now()
    from public.profils_coach pc
    join public.comptes c on c.id = pc.compte_id
   where pc.id = o.coach_id
     and (c.supprime_le is not null or pc.statut_verification = 'revoquee')
     and o.publiee_le is not null
     and o.retiree_le is null;

  with concernes as (
    select a.id
      from public.abonnements a
      join public.profils_client pcl on pcl.id = a.profil_client_id
      join public.comptes cc on cc.id = pcl.compte_id
      join public.profils_coach pco on pco.id = a.profil_coach_id
      join public.comptes co on co.id = pco.compte_id
     where (cc.supprime_le is not null or co.supprime_le is not null
            or pco.statut_verification = 'revoquee')
       and a.statut = 'actif'
       for update of a
  )
  update public.abonnements a
     set statut = 'resiliation_programmee',
         resilie_le = now(),
         fin_acces_le = a.prochain_prelevement_le
    from concernes
   where a.id = concernes.id;
  get diagnostics v_programmes = row_count;

  with concernes as (
    select a.id
      from public.abonnements a
      join public.profils_client pcl on pcl.id = a.profil_client_id
      join public.comptes cc on cc.id = pcl.compte_id
      join public.profils_coach pco on pco.id = a.profil_coach_id
      join public.comptes co on co.id = pco.compte_id
     where (cc.supprime_le is not null or co.supprime_le is not null
            or pco.statut_verification = 'revoquee')
       and a.statut in ('en_pause', 'impaye', 'suspendu')
       for update of a
  )
  update public.abonnements a
     set statut = 'resilie',
         resilie_le = now(),
         fin_acces_le = p_jour,
         pause_jusqu_le = null
    from concernes
   where a.id = concernes.id;
  get diagnostics v_resilies = row_count;

  return v_programmes + v_resilies;
end;
$$;

-- Aucun rôle de l'application ne l'appelle : supprimer_mon_compte et appliquer_echeances seules
-- (security definer).
revoke execute on function public.resilier_abonnements_des_comptes_supprimes(date)
  from public, anon, authenticated, service_role;

create or replace function public.annuler_resiliation(p_abonnement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abonnement public.abonnements := public.mon_abonnement_verrouille(p_abonnement_id);
begin
  if v_abonnement.statut <> 'resiliation_programmee' then
    raise exception 'transition_interdite';
  end if;
  if exists (
    select 1
      from public.profils_client pcl
      join public.comptes cc on cc.id = pcl.compte_id
     where pcl.id = v_abonnement.profil_client_id and cc.supprime_le is not null
  ) or exists (
    select 1
      from public.profils_coach pco
      join public.comptes co on co.id = pco.compte_id
     where pco.id = v_abonnement.profil_coach_id
       and (co.supprime_le is not null or pco.statut_verification = 'revoquee')
  ) then
    raise exception 'transition_interdite';
  end if;
  update public.abonnements
     set statut = 'actif', resilie_le = null, fin_acces_le = null
   where id = p_abonnement_id;
end;
$$;

revoke execute on function public.annuler_resiliation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.annuler_resiliation(uuid) to authenticated;

