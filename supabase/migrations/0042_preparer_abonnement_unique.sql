-- Préparation de la règle d'abonnement unique -- L4, P4.5d (docs/domaine.md §3.2, « Règle
-- d'abonnement unique », tranchée le 31 octobre 2026). La règle elle-même est 0043 : séparée
-- pour que ses tests de banc soient rouges sur la RÈGLE absente, pas sur une fixture absente.
--
-- 1. Le motif d'anomalie abonnement_existant (consigné par 0043).
-- 2. clore_abonnements_banc : le banc RLS crée beaucoup d'abonnements pour le même client chez
--    le même coach ; sous la règle, chaque test qui en crée un doit partir d'un client sans
--    abonnement en cours. Cette fonction clôt ceux du banc, et SEULEMENT ceux du banc : ses
--    références de paiement commencent par `cs_banc_` ou `banc-` (src/test/rls.banc.ts), une
--    référence réelle commence par `cs_test_` ou `cs_live_`. Préfixes écrits en dur, même
--    principe que purger_anomalies_banc (0041). Le serveur seul.

-- ADD VALUE dans une transaction : permis tant que la valeur n'est pas utilisée avant la
-- validation ; les corps plpgsql de 0043 ne la lisent qu'à l'exécution.
alter type public.anomalie_paiement_motif_enum add value 'abonnement_existant';

create or replace function public.clore_abonnements_banc(p_profil_client_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closes integer;
begin
  -- Jamais actif (en attente de confirmation) -> annule ; déjà actif une fois -> resilie, accès
  -- fini aujourd'hui. Contraintes de 0033 respectées : actif_depuis_le nulle exactement pour
  -- en_attente_confirmation et annule, pause levée, fin d'accès posée pour resilie.
  update public.abonnements
     set statut = case when actif_depuis_le is null then 'annule' else 'resilie' end::public.abonnement_statut_enum,
         pause_jusqu_le = null,
         fin_acces_le = coalesce(fin_acces_le, (now() at time zone 'Europe/Paris')::date)
   where profil_client_id = p_profil_client_id
     and statut not in ('resilie', 'annule')
     and (starts_with(reference_paiement, 'cs_banc_') or starts_with(reference_paiement, 'banc-'));
  get diagnostics v_closes = row_count;
  return v_closes;
end;
$$;

revoke execute on function public.clore_abonnements_banc(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.clore_abonnements_banc(uuid) to service_role;
