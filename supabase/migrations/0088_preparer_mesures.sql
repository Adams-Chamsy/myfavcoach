-- L7, P7.2 — les mesures corporelles. DÉCOR seulement : les tables, et les fonctions avec leur
-- signature et leurs droits, dont le corps refuse (« non_implemente »). Les règles arrivent en
-- 0089. docs/domaine.md §3.7 ; docs/ecrans/L7-06-suivi.md ; docs/prompts/L7.md.
--
-- Donnée de santé (catégorie 9 RGPD) : aucun droit pour anon ni authenticated sur ces tables,
-- pas même en lecture. Le client passe par trois fonctions qui le désignent par sa session
-- (docs/backend.md §7) : enregistrer_mesure, mes_mesures, effacer_mes_mesures. Aucun coach n'a
-- de chemin vers ces lignes (docs/prompts/L7.md, décision 1).

-- Une ligne par mesure. valeur : grammes pour le poids, millimètres pour le tour de taille. Le
-- plafond est technique (1 000 kg, 1 000 cm, borne incluse), pas un seuil de vraisemblance :
-- les seuils de confirmation (20–300 kg, 40–200 cm) ne bloquent rien.
create table public.mesures_corporelles (
  id uuid primary key default gen_random_uuid(),
  profil_client_id uuid not null references public.profils_client (id) on delete cascade,
  type text not null check (type in ('poids', 'tour_de_taille')),
  valeur integer not null check (
    valeur > 0
    and ((type = 'poids' and valeur <= 1000000) or (type = 'tour_de_taille' and valeur <= 10000))
  ),
  mesuree_le date not null,
  enregistree_le timestamptz not null default clock_timestamp(),
  cle uuid not null,
  unique (profil_client_id, cle)
);
create index mesures_corporelles_profil_type_idx
  on public.mesures_corporelles (profil_client_id, type, mesuree_le, enregistree_le);
alter table public.mesures_corporelles enable row level security;
revoke all on public.mesures_corporelles from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.mesures_corporelles to service_role;

-- Les clés de réessai déjà utilisées, gardées APRÈS l'effacement des mesures : sans elles, un
-- réessai parti avant l'effacement et arrivé après recréerait une mesure supprimée. Ni type ni
-- valeur ici : rien de cette table n'est une donnée de santé.
create table public.cles_mesures (
  profil_client_id uuid not null references public.profils_client (id) on delete cascade,
  cle uuid not null,
  utilisee_le timestamptz not null default now(),
  primary key (profil_client_id, cle)
);
alter table public.cles_mesures enable row level security;
revoke all on public.cles_mesures from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.cles_mesures to service_role;

create or replace function public.enregistrer_mesure(p_type text, p_valeur numeric, p_cle uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.enregistrer_mesure(text, numeric, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_mesure(text, numeric, uuid) to authenticated;

create or replace function public.mes_mesures()
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
revoke execute on function public.mes_mesures() from public, anon, authenticated, service_role;
grant execute on function public.mes_mesures() to authenticated;

create or replace function public.effacer_mes_mesures()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.effacer_mes_mesures()
  from public, anon, authenticated, service_role;
grant execute on function public.effacer_mes_mesures() to authenticated;
