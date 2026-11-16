-- Supprimer son compte résilie ses abonnements (16 novembre 2026 ; docs/dette.md, « Suppression
-- de compte et abonnements » ; docs/ecrans/L2-01-suppression-compte.md).
--
-- Trouvé le 15 novembre 2026 : supprimer_mon_compte (0018, antérieure à L4) pose seulement
-- comptes.supprime_le, et rien ne relie cette date aux abonnements. Le moteur d'échéances aurait
-- continué de prélever chaque mois un client qui a supprimé son compte, et les abonnés d'un coach
-- qui a supprimé le sien. La fiche promet pourtant « Supprimer ton compte résilie ton suivi » et,
-- côté coach, « tes offres sont retirées ; tes abonnés en cours gardent l'accès jusqu'à la fin de
-- leur période payée ».
--
-- Règles, celles de la résiliation demandée par le client (demander_resiliation, 0033 ;
-- docs/domaine.md §4.3), appliquées aux abonnements dont le compte du client OU celui du coach
-- est supprimé :
--   actif                         -> resiliation_programmee, fin d'accès à la fin de la période
--                                    payée (plus aucun prélèvement) ;
--   en_pause | impaye | suspendu  -> resilie, le jour même, rien de plus facturé ;
--   en_attente_confirmation       -> inchangé : la banque n'a pas répondu. S'il devient actif,
--                                    le filet du matin (ci-dessous) le programme en résiliation
--                                    avant toute échéance suivante.
-- Aucun remboursement au prorata : la fiche L2-01 le tranche, et aucun remboursement n'existe
-- dans l'application (docs/perimetre.md §3). docs/domaine.md §4.3 portait encore « coach part ->
-- resilie [prorata remboursé] » : corrigé dans le même commit, à relire par le développeur.
--
-- Deux déclencheurs, une seule fonction :
--   - supprimer_mon_compte, au moment de la demande ;
--   - appliquer_echeances, chaque matin, AVANT les prélèvements : le filet (SEPA confirmé après
--     la suppression, compte supprimé par un autre chemin qu'on n'aurait pas prévu).
-- Et annuler_resiliation refuse quand l'un des deux comptes est supprimé : une résiliation
-- programmée par la suppression ne s'annule pas.

create function public.resilier_abonnements_des_comptes_supprimes(
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
  -- Les offres publiées d'un coach supprimé sont retirées : plus aucune souscription possible
  -- (creer_intention_souscription rend offre_indisponible).
  update public.offres o
     set retiree_le = now()
    from public.profils_coach pc
    join public.comptes c on c.id = pc.compte_id
   where pc.id = o.coach_id
     and c.supprime_le is not null
     and o.publiee_le is not null
     and o.retiree_le is null;

  with concernes as (
    select a.id
      from public.abonnements a
      join public.profils_client pcl on pcl.id = a.profil_client_id
      join public.comptes cc on cc.id = pcl.compte_id
      join public.profils_coach pco on pco.id = a.profil_coach_id
      join public.comptes co on co.id = pco.compte_id
     where (cc.supprime_le is not null or co.supprime_le is not null)
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
     where (cc.supprime_le is not null or co.supprime_le is not null)
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

-- supprimer_mon_compte : identique à 0018, plus la résiliation.
create or replace function public.supprimer_mon_compte(p_motif text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comptes
  set supprime_le = now(),
      motif_suppression = nullif(btrim(coalesce(p_motif, '')), '')
  where id = auth.uid()
    and supprime_le is null;

  if not found then
    raise exception 'compte introuvable ou deja marque supprime';
  end if;

  perform public.resilier_abonnements_des_comptes_supprimes();
end;
$$;

revoke execute on function public.supprimer_mon_compte(text)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_mon_compte(text) to authenticated;

-- annuler_resiliation : identique à 0033, plus le refus quand l'un des deux comptes est supprimé.
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
     where pco.id = v_abonnement.profil_coach_id and co.supprime_le is not null
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

-- appliquer_echeances : identique à 0044, précédée du filet. La résiliation d'abord : un
-- abonnement programmé ce matin n'est pas prélevé ce matin (echeances_a_prelever ne rend que
-- actif, impaye, suspendu).
create or replace function public.appliquer_echeances(
  p_jour date default (now() at time zone 'Europe/Paris')::date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comptes_supprimes integer;
  v_reprises integer;
  v_fins_programmees integer;
  v_suspensions integer;
  v_resiliations integer;
begin
  v_comptes_supprimes := public.resilier_abonnements_des_comptes_supprimes(p_jour);

  -- Reprise à l'échéance de la pause (§4.3, tranché le 28 septembre 2026) : même règle que
  -- reprendre_abonnement (0033), sur le jour de fin de pause — le nouveau cycle s'ouvre par son
  -- prélèvement, ce jour-là (echeances_a_prelever le rend dû).
  update public.abonnements
     set statut = 'actif',
         jour_prelevement = public.jour_prelevement_pour(pause_jusqu_le),
         prochain_prelevement_le = pause_jusqu_le,
         pause_jusqu_le = null
   where statut = 'en_pause' and pause_jusqu_le <= p_jour;
  get diagnostics v_reprises = row_count;

  -- Fin de la période payée d'une résiliation programmée : l'échéance n'est jamais prélevée.
  update public.abonnements
     set statut = 'resilie'
   where statut = 'resiliation_programmee' and fin_acces_le <= p_jour;
  get diagnostics v_fins_programmees = row_count;

  -- J+7 sans succès (§4.4, « abandonne ») : suspendu. Jamais tant qu'une tentative est en cours
  -- (son issue, SEPA différé, peut encore être un succès).
  update public.abonnements a
     set statut = 'suspendu'
   where a.statut = 'impaye'
     and a.prochain_prelevement_le + 7 <= p_jour
     and not exists (
       select 1 from public.tentatives_prelevement t
        where t.abonnement_id = a.id
          and t.echeance_le = a.prochain_prelevement_le
          and t.statut in ('en_cours', 'reussie')
     );
  get diagnostics v_suspensions = row_count;

  -- 30 jours de suspension (§4.3) : resilie, accès fini ce jour-là. La suspension commence à
  -- J+7 de l'échéance restée impayée : 30 jours plus tard, c'est J+37.
  update public.abonnements
     set statut = 'resilie', resilie_le = now(), fin_acces_le = p_jour
   where statut = 'suspendu' and prochain_prelevement_le + 37 <= p_jour;
  get diagnostics v_resiliations = row_count;

  return jsonb_build_object(
    'comptes_supprimes', v_comptes_supprimes,
    'reprises', v_reprises,
    'fins_programmees', v_fins_programmees,
    'suspensions', v_suspensions,
    'resiliations', v_resiliations
  );
end;
$$;

revoke execute on function public.appliquer_echeances(date)
  from public, anon, authenticated, service_role;
grant execute on function public.appliquer_echeances(date) to service_role;
