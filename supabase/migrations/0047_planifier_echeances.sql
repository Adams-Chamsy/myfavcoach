-- La tâche planifiée des échéances -- L4, P4.8b (docs/prompts/L4.md ; décidé le 1er novembre 2026 :
-- 6 h, heure de Paris). pg_cron et pg_net sont disponibles sur le plan gratuit (vérifié le même
-- jour sur le projet de dev).
--
-- Chaque matin, pg_cron appelle declencher_echeances, qui appelle (pg_net) l'Edge Function
-- echeances-quotidiennes avec la clé partagée lue dans Vault. C'est la fonction qui prélève : la
-- base ne parle jamais à Stripe.
--
-- 6 h à Paris, c'est 5 h UTC l'hiver et 4 h UTC l'été, et pg_cron compte en UTC. Deux
-- déclenchements (4 h et 5 h UTC), et declencher_echeances ne fait rien hors de 6 h à Paris :
-- exactement un appel par jour, toute l'année, sans changement d'heure à suivre.
--
-- Secrets dans Vault, jamais dans cette migration : « cle_tache_planifiee » et
-- « url_echeances_quotidiennes », posés par scripts/poser-cle-tache-planifiee.sh. Absents (pile
-- fraîche de la CI, projet pas encore configuré) : rien n'est appelé, un avertissement est noté.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- p_jour : le jour à traiter, pour un rattrapage à la main (et l'essai de P4.8b). Sans lui, le
-- jour de Paris — et seulement à 6 h de Paris.
create or replace function public.declencher_echeances(p_jour date default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_cle text;
  v_corps jsonb := '{}'::jsonb;
begin
  if p_jour is null then
    if extract(hour from now() at time zone 'Europe/Paris') <> 6 then
      return null;
    end if;
  else
    v_corps := jsonb_build_object('jour', p_jour);
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'url_echeances_quotidiennes';
  select decrypted_secret into v_cle
    from vault.decrypted_secrets where name = 'cle_tache_planifiee';
  if v_url is null or v_cle is null then
    raise warning 'echeances : url_echeances_quotidiennes ou cle_tache_planifiee absente de Vault';
    return null;
  end if;

  -- Rend l'identifiant de la requête (net._http_response) : sa réponse s'y lit ensuite.
  return net.http_post(
    url := v_url,
    body := v_corps,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cle-tache', v_cle),
    timeout_milliseconds := 120000
  );
end;
$$;

-- Personne ne l'appelle depuis l'API : pg_cron l'exécute en tant que propriétaire.
revoke execute on function public.declencher_echeances(date)
  from public, anon, authenticated, service_role;

select cron.schedule('echeances-04h-utc', '0 4 * * *', 'select public.declencher_echeances()');
select cron.schedule('echeances-05h-utc', '0 5 * * *', 'select public.declencher_echeances()');
