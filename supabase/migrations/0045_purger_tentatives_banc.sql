-- La purge des anomalies du banc couvre aussi ses tentatives de prélèvement -- L4, P4.8a.
--
-- 0041 ne connaissait qu'un préfixe, `cs_banc_` (sessions de paiement fictives). Les tentatives
-- de prélèvement du banc de P4.8a portent des références `pi_banc_<exécution>_<nom>` (un paiement,
-- pas une session), et leurs anomalies (paiement_hors_abonnement) restaient sur le projet de dev
-- à chaque passage. Même motif que les 82 anomalies `cs_banc_` du 31 octobre 2026 : un préfixe
-- oublié par la purge s'accumule en silence. Corrigé le 1er novembre 2026, avant qu'il ne pèse.
--
-- Mêmes garanties que 0041 : les préfixes sont écrits ici, en dur ; l'appelant ne peut que
-- restreindre à une exécution du banc (un numéro) ; le serveur seul. Une référence réelle
-- commence par `cs_test_`, `cs_live_` ou `pi_` suivi d'autre chose que `banc_`.

create or replace function public.purger_anomalies_banc(p_execution text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suffixe text := coalesce(p_execution || '_', '');
  v_supprimees integer;
begin
  if p_execution is not null and p_execution !~ '^[0-9]+$' then
    raise exception 'execution_invalide';
  end if;
  delete from public.anomalies_paiement
   where starts_with(session_prestataire, 'cs_banc_' || v_suffixe)
      or starts_with(session_prestataire, 'pi_banc_' || v_suffixe);
  get diagnostics v_supprimees = row_count;
  return v_supprimees;
end;
$$;

revoke execute on function public.purger_anomalies_banc(text)
  from public, anon, authenticated, service_role;
grant execute on function public.purger_anomalies_banc(text) to service_role;
