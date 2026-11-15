-- Rapprochement quotidien entre les paiements du prestataire et nos factures (15 novembre 2026,
-- P4.11a ; docs/prompts/L4.md, point 12 ; docs/backend.md §13).
--
-- Le webhook peut manquer un événement pour de bon, et une écriture chez nous peut réussir sans
-- que l'argent n'arrive : rien ne le verrait. Chaque matin, la tâche des échéances
-- (echeances-quotidiennes) compare dans les deux sens, et ÉCRIT ICI ce qui ne correspond pas.
-- Elle signale, elle ne corrige jamais : une facture est immuable (docs/domaine.md §2), une
-- correction est une ligne décidée par une personne.
--
-- La comparaison elle-même est dans la fonction serveur (elle parle au prestataire, la base ne
-- le fait jamais). Cette migration ne pose que le stockage et ses lectures : aucune règle métier,
-- donc une seule migration, sans découpe décor/règle.
--
-- Trois classes (point 12) :
--   encaisse_sans_facture     : un paiement réussi chez le prestataire, aucune facture ne le porte ;
--   facture_sans_encaissement : une facture payée dont la référence n'existe pas, ou pas comme
--                               réussie, chez le prestataire ;
--   montant_different         : les deux existent, les montants divergent.

create type public.ecart_rapprochement_classe_enum as enum (
  'encaisse_sans_facture',
  'facture_sans_encaissement',
  'montant_different'
);

create table public.ecarts_rapprochement (
  id uuid primary key default gen_random_uuid(),
  classe public.ecart_rapprochement_classe_enum not null,
  -- La référence du paiement chez le prestataire : celle que porte la facture
  -- (factures.reference_prestataire), ou celle du paiement sans facture.
  reference_prestataire text not null,
  montant_prestataire_centimes integer,
  montant_facture_centimes integer,
  detecte_le timestamptz not null default now(),
  -- Posée à la main par la personne qui a regardé l'écart ; jamais par la tâche.
  traite_le timestamptz,
  -- Un écart ne s'écrit qu'une fois : le rapprochement du lendemain recouvre la même fenêtre.
  unique (classe, reference_prestataire)
);

alter table public.ecarts_rapprochement enable row level security;
revoke all on public.ecarts_rapprochement from public, anon, authenticated, service_role;
grant select on public.ecarts_rapprochement to service_role;

-- Les factures payées entre deux jours de Paris, bornes comprises : ce que la tâche vérifie
-- chez le prestataire.
create function public.factures_payees_entre(p_du date, p_au date)
returns table (reference_prestataire text, montant_ttc_centimes integer)
language sql
stable
security definer
set search_path = public
as $$
  select f.reference_prestataire, f.montant_ttc_centimes
    from public.factures f
   where (f.payee_le at time zone 'Europe/Paris')::date between p_du and p_au
   order by f.payee_le, f.reference_prestataire;
$$;

revoke execute on function public.factures_payees_entre(date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.factures_payees_entre(date, date) to service_role;

-- Les factures qui portent l'une de ces références, quelle que soit leur date : ce que la tâche
-- cherche pour chaque paiement réussi chez le prestataire.
create function public.factures_par_reference(p_references text[])
returns table (reference_prestataire text, montant_ttc_centimes integer)
language sql
stable
security definer
set search_path = public
as $$
  select f.reference_prestataire, f.montant_ttc_centimes
    from public.factures f
   where f.reference_prestataire = any (p_references);
$$;

revoke execute on function public.factures_par_reference(text[])
  from public, anon, authenticated, service_role;
grant execute on function public.factures_par_reference(text[]) to service_role;

-- Écrit un écart, une seule fois par classe et par référence. Rend vrai s'il est nouveau.
create function public.enregistrer_ecart_rapprochement(
  p_classe public.ecart_rapprochement_classe_enum,
  p_reference text,
  p_montant_prestataire integer,
  p_montant_facture integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_reference is null or p_reference = '' then
    raise exception 'reference_requise';
  end if;
  insert into public.ecarts_rapprochement (
    classe, reference_prestataire, montant_prestataire_centimes, montant_facture_centimes
  )
  values (p_classe, p_reference, p_montant_prestataire, p_montant_facture)
  on conflict (classe, reference_prestataire) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke execute on function public.enregistrer_ecart_rapprochement(
  public.ecart_rapprochement_classe_enum, text, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_ecart_rapprochement(
  public.ecart_rapprochement_classe_enum, text, integer, integer
) to service_role;

-- Le banc écrit des factures sous des références qui n'existent chez aucun prestataire
-- (« cs_banc_… », « pi_banc_… », « banc-… ») : sur le projet de développement, chaque matin les
-- signalerait. Même principe que purger_anomalies_banc (0041) : le préfixe du banc seul.
create function public.purger_ecarts_rapprochement_banc()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supprimes integer;
begin
  delete from public.ecarts_rapprochement
   where reference_prestataire ~ '^(cs_banc_|pi_banc_|banc-)';
  get diagnostics v_supprimes = row_count;
  return v_supprimes;
end;
$$;

revoke execute on function public.purger_ecarts_rapprochement_banc()
  from public, anon, authenticated, service_role;
grant execute on function public.purger_ecarts_rapprochement_banc() to service_role;

-- declencher_echeances gagne un second paramètre : ne faire QUE le rapprochement d'un jour donné
-- (un rattrapage à la main, et la preuve de la porte de sortie de L4), sans rejouer les
-- prélèvements de ce jour. La tâche planifiée appelle toujours sans paramètre : rien ne change
-- pour elle. Le type de la fonction change : drop, puis create ; les deux tâches pg_cron la
-- désignent par son nom, elles n'ont pas à être reposées.
drop function public.declencher_echeances(date);

create function public.declencher_echeances(
  p_jour date default null,
  p_rapprochement_seul boolean default false
)
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
    if p_rapprochement_seul then
      raise exception 'jour_requis';
    end if;
    if extract(hour from now() at time zone 'Europe/Paris') <> 6 then
      return null;
    end if;
  else
    v_corps := jsonb_build_object('jour', p_jour);
    if p_rapprochement_seul then
      v_corps := v_corps || jsonb_build_object('rapprochementSeul', true);
    end if;
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
revoke execute on function public.declencher_echeances(date, boolean)
  from public, anon, authenticated, service_role;
