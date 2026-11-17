-- L6, P6.2 — programmes, séances, exercices. DÉCOR seulement : les tables, leurs droits, et les
-- fonctions avec leur signature et leurs droits, dont le corps refuse (« non_implemente »). Les
-- règles arrivent en 0081, pour que le banc rougisse sur des assertions, pas sur des fonctions
-- absentes (même découpe que 0069/0070 et suivantes). docs/domaine.md §3.6, §4.6 ;
-- docs/prompts/L6.md ; docs/ecrans/L6-11-studio.md.
--
-- Aucune table n'est lisible ni inscriptible par l'application : tout passe par les fonctions.

create type public.programme_statut_enum as enum ('brouillon', 'publie', 'archive');

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  profil_coach_id uuid not null references public.profils_coach (id) on delete cascade,
  titre text not null default '',
  duree_semaines smallint not null default 4 check (duree_semaines between 1 and 12),
  statut public.programme_statut_enum not null default 'brouillon',
  cree_le timestamptz not null default now(),
  publie_le timestamptz,
  archive_le timestamptz
);
create index programmes_profil_coach_idx on public.programmes (profil_coach_id);
alter table public.programmes enable row level security;
revoke all on public.programmes from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.programmes to service_role;

-- jour_relatif : le jour de la séance dans le programme, à partir de 1 (docs/domaine.md §3.6).
create table public.seances (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes (id) on delete cascade,
  titre text not null default '',
  duree_minutes smallint not null default 30 check (duree_minutes between 1 and 300),
  jour_relatif smallint not null check (jour_relatif >= 1),
  cree_le timestamptz not null default now()
);
create index seances_programme_idx on public.seances (programme_id);
alter table public.seances enable row level security;
revoke all on public.seances from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.seances to service_role;

create table public.exercices (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  ordre smallint not null,
  nom text not null,
  series smallint check (series between 1 and 20),
  repetitions smallint check (repetitions between 1 and 200),
  charge_grammes integer check (charge_grammes between 0 and 500000),
  consigne text not null default ''
);
create index exercices_seance_idx on public.exercices (seance_id);
alter table public.exercices enable row level security;
revoke all on public.exercices from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.exercices to service_role;

create or replace function public.mon_programme_verrouille(p_programme_id uuid)
returns public.programmes
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.mon_programme_verrouille(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.mon_brouillon_verrouille(p_programme_id uuid)
returns public.programmes
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.mon_brouillon_verrouille(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.ma_seance_en_brouillon(p_seance_id uuid)
returns public.seances
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.ma_seance_en_brouillon(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.creer_programme()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.creer_programme()
  from public, anon, authenticated, service_role;
grant execute on function public.creer_programme() to authenticated;

create or replace function public.modifier_programme(
  p_programme_id uuid,
  p_titre text,
  p_duree_semaines smallint
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
revoke execute on function public.modifier_programme(uuid, text, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.modifier_programme(uuid, text, smallint) to authenticated;

create or replace function public.mes_programmes()
returns table (
  id uuid,
  titre text,
  duree_semaines smallint,
  statut public.programme_statut_enum,
  nombre_seances integer,
  abonnes_en_cours integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.mes_programmes()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_programmes() to authenticated;

create or replace function public.seances_du_programme(p_programme_id uuid)
returns table (
  id uuid,
  titre text,
  duree_minutes smallint,
  jour_relatif smallint,
  nombre_exercices integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.seances_du_programme(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.seances_du_programme(uuid) to authenticated;

create or replace function public.exercices_de_la_seance(p_seance_id uuid)
returns table (
  id uuid,
  ordre smallint,
  nom text,
  series smallint,
  repetitions smallint,
  charge_grammes integer,
  consigne text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.exercices_de_la_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.exercices_de_la_seance(uuid) to authenticated;

create or replace function public.ajouter_seance(p_programme_id uuid, p_jour_relatif smallint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.ajouter_seance(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.ajouter_seance(uuid, smallint) to authenticated;

create or replace function public.modifier_seance(
  p_seance_id uuid,
  p_titre text,
  p_duree_minutes smallint,
  p_jour_relatif smallint
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
revoke execute on function public.modifier_seance(uuid, text, smallint, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.modifier_seance(uuid, text, smallint, smallint) to authenticated;

create or replace function public.supprimer_seance(p_seance_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.supprimer_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_seance(uuid) to authenticated;

create or replace function public.dupliquer_semaine(p_programme_id uuid, p_semaine smallint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.dupliquer_semaine(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function public.dupliquer_semaine(uuid, smallint) to authenticated;

create or replace function public.ajouter_exercice(
  p_seance_id uuid,
  p_nom text,
  p_series smallint,
  p_repetitions smallint,
  p_charge_grammes integer,
  p_consigne text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.ajouter_exercice(uuid, text, smallint, smallint, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.ajouter_exercice(uuid, text, smallint, smallint, integer, text) to authenticated;

create or replace function public.supprimer_exercice(p_exercice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.supprimer_exercice(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_exercice(uuid) to authenticated;

create or replace function public.deplacer_exercice(p_exercice_id uuid, p_sens text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.deplacer_exercice(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.deplacer_exercice(uuid, text) to authenticated;

create or replace function public.publier_programme(p_programme_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.publier_programme(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.publier_programme(uuid) to authenticated;

create or replace function public.archiver_programme(p_programme_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.archiver_programme(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.archiver_programme(uuid) to authenticated;

create or replace function public.revenir_en_edition(p_programme_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.revenir_en_edition(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.revenir_en_edition(uuid) to authenticated;
