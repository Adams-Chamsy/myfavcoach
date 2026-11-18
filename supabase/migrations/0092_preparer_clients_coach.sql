-- L7, P7.3b — les clients du coach. DÉCOR seulement : la table des notes privées, et les cinq
-- fonctions du coach avec leur signature et leurs droits, dont le corps refuse
-- (« non_implemente »). Les règles arrivent en 0093. docs/ecrans/L7-08-pilotage.md,
-- L7-09-clients.md, L7-10-fiche-client.md ; docs/prompts/L7.md (décisions 1, 2, 6, 7, 8).
--
-- Aucune de ces fonctions ne lit ni ne rend une donnée de santé (décision 1) : ni poids, ni tour
-- de taille, ni ressenti d'effort, même agrégés. src/test/coach-sans-donnee-sante.test.ts le
-- vérifie sur le SQL, le banc sur les réponses.

-- Une note par couple coach–client (pas par abonnement : elle réapparaît si le client se
-- réabonne, choix validé le 18 novembre 2026, arbitrage des anciens clients encore ouvert).
-- Le coach peut y écrire une information de santé confiée par son client : aucun droit pour
-- anon ni authenticated, pas même en lecture ; ni journal, ni export automatique (L7-10).
create table public.notes_clients (
  profil_coach_id uuid not null references public.profils_coach (id) on delete cascade,
  profil_client_id uuid not null references public.profils_client (id) on delete cascade,
  texte text not null check (length(texte) between 1 and 2000),
  modifiee_le timestamptz not null default now(),
  primary key (profil_coach_id, profil_client_id)
);
alter table public.notes_clients enable row level security;
revoke all on public.notes_clients from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.notes_clients to service_role;

create or replace function public.mes_clients()
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
revoke execute on function public.mes_clients() from public, anon, authenticated, service_role;
grant execute on function public.mes_clients() to authenticated;

create or replace function public.mes_anciens_clients()
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
revoke execute on function public.mes_anciens_clients()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_anciens_clients() to authenticated;

create or replace function public.fiche_client(p_profil_client_id uuid)
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
revoke execute on function public.fiche_client(uuid) from public, anon, authenticated, service_role;
grant execute on function public.fiche_client(uuid) to authenticated;

create or replace function public.enregistrer_notes_client(p_profil_client_id uuid, p_texte text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.enregistrer_notes_client(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_notes_client(uuid, text) to authenticated;

create or replace function public.mon_pilotage()
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
revoke execute on function public.mon_pilotage() from public, anon, authenticated, service_role;
grant execute on function public.mon_pilotage() to authenticated;
