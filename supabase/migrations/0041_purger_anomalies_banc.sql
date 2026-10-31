-- Purge des anomalies de paiement laissées par le banc RLS -- L4, P4.5c, étape 4 (docs/dette.md,
-- « Le banc RLS laisse des anomalies de paiement ouvertes sur le projet de dev »).
--
-- Le banc écrit de vraies anomalies sur des sessions FICTIVES (`cs_banc_<exécution>_<nom>`,
-- src/test/rls.banc.ts). Aucune ne peut être rattrapée (Stripe ne les connaît pas), et elles
-- noieraient une vraie anomalie : le compteur relevé à la porte de sortie de L4
-- (`npm run anomalies:retraiter`, zéro attendu) ne pourrait jamais valoir zéro sur le projet de dev.
--
-- Une anomalie n'est pas une pièce comptable (à la différence des factures de 0036) : rien
-- n'interdit d'en supprimer. Mais seulement celles du banc. La fonction ne prend AUCUN motif ni
-- filtre libre : le préfixe `cs_banc_` est écrit ici, en dur ; l'appelant peut seulement
-- restreindre à une exécution du banc. Une session réelle commence par `cs_test_` ou `cs_live_`.

create or replace function public.purger_anomalies_banc(p_execution text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefixe text := 'cs_banc_' || coalesce(p_execution || '_', '');
  v_supprimees integer;
begin
  if p_execution is not null and p_execution !~ '^[0-9]+$' then
    raise exception 'execution_invalide';
  end if;
  delete from public.anomalies_paiement
   where starts_with(session_prestataire, v_prefixe);
  get diagnostics v_supprimees = row_count;
  return v_supprimees;
end;
$$;

revoke execute on function public.purger_anomalies_banc(text)
  from public, anon, authenticated, service_role;
grant execute on function public.purger_anomalies_banc(text) to service_role;
