-- Le moyen de paiement conservé pour les échéances -- L4, P4.8b (docs/backend.md, « Pas de Stripe
-- Billing » : chaque échéance est un paiement hors session sur le moyen enregistré au premier
-- paiement, setup_future_usage = off_session, abonnement-intention).
--
-- Jusqu'ici, seul le client Stripe était conservé (reference_client_prestataire, 0037) : il porte
-- le moyen enregistré, mais un paiement hors session doit NOMMER ce moyen. Sa référence est posée
-- par la synchronisation de la session (webhook ou constat), une seule fois.
--
-- Réservée au serveur, comme le client Stripe : authenticated ne lit les abonnements que par une
-- liste de colonnes nommées (0033), cette colonne n'y est pas — jamais lisible depuis
-- l'application (CLAUDE.md §10). service_role la lit (select sur la table, 0033).

alter table public.abonnements add column reference_moyen_prestataire text;

-- Posée une fois, jamais écrasée : un second événement pour la même session ne la change pas.
-- Aucun refus si l'abonnement n'existe pas encore (paiement non abouti, coach écarté) : rien à
-- conserver, rien d'écrit.
create or replace function public.memoriser_moyen_paiement(
  p_reference_paiement text,
  p_moyen_prestataire text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.abonnements
     set reference_moyen_prestataire = p_moyen_prestataire
   where reference_paiement = p_reference_paiement
     and reference_moyen_prestataire is null;
end;
$$;

revoke execute on function public.memoriser_moyen_paiement(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.memoriser_moyen_paiement(text, text) to service_role;
