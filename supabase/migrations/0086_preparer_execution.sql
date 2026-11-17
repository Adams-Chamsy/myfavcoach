-- L6, P6.5 — l'exécution d'une séance. DÉCOR seulement : la table des séries saisies, et les
-- fonctions avec leur signature et leurs droits, dont le corps refuse (« non_implemente » ; la
-- tâche du matin, elle, ne marque rien). Les règles arrivent en 0087. docs/domaine.md §4.5.
--
-- Une ligne par série saisie : les « valeursSaisies » de §3.6. Répétitions et charge ne sont pas
-- des données de santé (docs/prompts/L6.md, décision 7).
create table public.series_saisies (
  seance_programmee_id uuid not null references public.seances_programmees (id) on delete cascade,
  exercice_id uuid not null references public.exercices (id) on delete cascade,
  numero smallint not null check (numero between 1 and 20),
  repetitions smallint check (repetitions between 0 and 500),
  charge_grammes integer check (charge_grammes between 0 and 500000),
  saisie_le timestamptz not null default now(),
  primary key (seance_programmee_id, exercice_id, numero)
);
alter table public.series_saisies enable row level security;
revoke all on public.series_saisies from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.series_saisies to service_role;

create or replace function public.demarrer_seance(p_seance_programmee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.demarrer_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.demarrer_seance(uuid) to authenticated;

create or replace function public.enregistrer_serie(
  p_seance_programmee_id uuid,
  p_exercice_id uuid,
  p_numero smallint,
  p_repetitions smallint,
  p_charge_grammes integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.enregistrer_serie(uuid, uuid, smallint, smallint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_serie(uuid, uuid, smallint, smallint, integer) to authenticated;

create or replace function public.terminer_seance(
  p_seance_programmee_id uuid,
  p_ressenti_effort smallint,
  p_commentaire text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.terminer_seance(uuid, smallint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.terminer_seance(uuid, smallint, text) to authenticated;

create or replace function public.series_de_ma_seance(p_seance_programmee_id uuid)
returns table (exercice_id uuid, numero smallint, repetitions smallint, charge_grammes integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.series_de_ma_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.series_de_ma_seance(uuid) to authenticated;

create or replace function public.marquer_seances_echues(p_jour date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0;
end;
$$;
revoke execute on function public.marquer_seances_echues(date)
  from public, anon, authenticated, service_role;
