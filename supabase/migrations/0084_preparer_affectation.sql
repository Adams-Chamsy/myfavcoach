-- L6, P6.4 — les séances programmées d'un abonné. DÉCOR seulement : la table, la politique de
-- lecture des médias par le client, et les fonctions nouvelles avec leur signature et leurs
-- droits, dont le corps refuse (« non_implemente »). Les règles, et les reprises de mes_programmes,
-- revenir_en_edition et supprimer_seance, arrivent en 0085. docs/prompts/L6.md, décisions 2 à 6.
--
-- Une ligne par séance d'un programme affectée à un abonné, à une date : la SeanceProgrammee de
-- docs/domaine.md §3.6. Son exécution (§4.5 : statut, démarrage, fin, ressenti) est portée par la
-- même ligne, une seule exécution par séance programmée ; les séries saisies arrivent en P6.5.

create type public.seance_programmee_statut_enum as enum (
  'a_faire',
  'en_cours',
  'faite',
  'partielle',
  'manquee'
);

create table public.seances_programmees (
  id uuid primary key default gen_random_uuid(),
  -- Une séance déjà programmée ne se supprime pas (supprimer_seance : seance_utilisee).
  seance_id uuid not null references public.seances (id) on delete restrict,
  programme_id uuid not null references public.programmes (id) on delete cascade,
  profil_client_id uuid not null references public.profils_client (id) on delete cascade,
  profil_coach_id uuid not null references public.profils_coach (id) on delete cascade,
  date_prevue date not null,
  statut public.seance_programmee_statut_enum not null default 'a_faire',
  demarree_le timestamptz,
  terminee_le timestamptz,
  rattrapee boolean not null default false,
  -- Donnée de santé (docs/domaine.md §3.12) : écrite seulement avec le consentement.
  ressenti_effort smallint check (ressenti_effort between 1 and 10),
  commentaire text check (length(commentaire) <= 500),
  cree_le timestamptz not null default now(),
  unique (seance_id, profil_client_id, date_prevue)
);
create index seances_programmees_client_date_idx
  on public.seances_programmees (profil_client_id, date_prevue);
create index seances_programmees_programme_idx on public.seances_programmees (programme_id);
alter table public.seances_programmees enable row level security;
revoke all on public.seances_programmees from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.seances_programmees to service_role;

create or replace function public.acces_contenu(p_profil_client_id uuid, p_profil_coach_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return false;
end;
$$;
revoke execute on function public.acces_contenu(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.mon_profil_client_en_espace_client()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.mon_profil_client_en_espace_client()
  from public, anon, authenticated, service_role;

create or replace function public.ma_seance_programmee_verifiee(p_seance_programmee_id uuid)
returns public.seances_programmees
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.ma_seance_programmee_verifiee(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.abonnes_affectables()
returns table (profil_client_id uuid, prenom text, initiale_nom text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.abonnes_affectables()
  from public, anon, authenticated, service_role;
grant execute on function public.abonnes_affectables() to authenticated;

create or replace function public.affecter_programme(
  p_programme_id uuid,
  p_profil_client_id uuid,
  p_debut date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.affecter_programme(uuid, uuid, date)
  from public, anon, authenticated, service_role;
grant execute on function public.affecter_programme(uuid, uuid, date) to authenticated;

create or replace function public.mes_seances_du_jour()
returns table (
  id uuid,
  titre text,
  duree_minutes smallint,
  nombre_exercices integer,
  coach_prenom text,
  coach_nom text,
  statut public.seance_programmee_statut_enum
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
revoke execute on function public.mes_seances_du_jour()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_seances_du_jour() to authenticated;

create or replace function public.ma_seance_programmee(p_seance_programmee_id uuid)
returns table (
  id uuid,
  titre text,
  duree_minutes smallint,
  date_prevue date,
  statut public.seance_programmee_statut_enum,
  demarree_le timestamptz,
  rattrapee boolean,
  coach_prenom text,
  coach_nom text
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
revoke execute on function public.ma_seance_programmee(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ma_seance_programmee(uuid) to authenticated;

create or replace function public.exercices_de_ma_seance(p_seance_programmee_id uuid)
returns table (
  id uuid,
  ordre smallint,
  nom text,
  series smallint,
  repetitions smallint,
  charge_grammes integer,
  consigne text,
  media_chemin text,
  media_type_mime text
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
revoke execute on function public.exercices_de_ma_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.exercices_de_ma_seance(uuid) to authenticated;

create or replace function public.media_lisible_par_client(p_chemin text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return false;
end;
$$;
revoke execute on function public.media_lisible_par_client(text)
  from public, anon, authenticated, service_role;
grant execute on function public.media_lisible_par_client(text) to authenticated;

-- Le client lit, par URL signée, un média d'une séance programmée à laquelle il a accès.
create policy medias_programmes_select_client
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'medias-programmes' and public.media_lisible_par_client(name));
