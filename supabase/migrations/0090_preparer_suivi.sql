-- L7, P7.3a — le suivi du client. DÉCOR seulement : la table de l'historique des statuts
-- d'abonnement et la fonction mon_suivi, dont le corps refuse (« non_implemente »). Les règles,
-- le déclencheur qui tient l'historique et son amorçage arrivent en 0091. docs/domaine.md §5.2,
-- §5.3 ; docs/ecrans/L7-06-suivi.md ; docs/prompts/L7.md.

-- Un statut d'abonnement et l'instant où il a commencé, une ligne par changement. Sert à savoir
-- si le client avait accès au contenu de son coach le JOUR PRÉVU d'une séance (revue du
-- 18 novembre 2026) : une séance prévue pendant une pause ou une suspension n'est ni comptée ni
-- relancée. Le statut au moment où tourne la tâche du matin ne suffit pas : le client peut avoir
-- repris entre-temps. Aucune donnée de santé ici ; aucun droit pour anon ni authenticated.
create table public.historique_statuts_abonnement (
  id bigint generated always as identity primary key,
  abonnement_id uuid not null references public.abonnements (id) on delete cascade,
  statut public.abonnement_statut_enum not null,
  depuis timestamptz not null default clock_timestamp()
);
create index historique_statuts_abonnement_idx
  on public.historique_statuts_abonnement (abonnement_id, depuis);
alter table public.historique_statuts_abonnement enable row level security;
revoke all on public.historique_statuts_abonnement from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.historique_statuts_abonnement to service_role;

create or replace function public.mon_suivi()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.mon_suivi() from public, anon, authenticated, service_role;
grant execute on function public.mon_suivi() to authenticated;
