-- L6, P6.3 — la bibliothèque de médias du coach. DÉCOR seulement : le dossier privé, ses
-- politiques, la table, et les fonctions avec leur signature et leurs droits, dont le corps
-- refuse (« non_implemente »). Les règles arrivent en 0083. docs/prompts/L6.md, décision 8.
--
-- Dossier PRIVÉ, comme pieces-verification (0012) : aucune URL permanente, lecture par URL
-- signée seulement. Un sous-dossier par coach, nommé par l'identifiant de son profil coach.
-- Types et poids limités par le dossier lui-même (50 Mo : limite du plan gratuit).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medias-programmes',
  'medias-programmes',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'video/mp4', 'application/pdf']
);

-- L'identifiant du profil coach du compte connecté, ou rien. Pour les politiques de
-- storage.objects : une sous-requête sur profils_coach y passerait par les droits du compte, et
-- mon_profil_coach_en_espace_coach lève au lieu de rendre faux.
create or replace function public.profil_coach_courant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pc.id from public.profils_coach pc where pc.compte_id = auth.uid();
$$;
revoke execute on function public.profil_coach_courant_id()
  from public, anon, authenticated, service_role;
grant execute on function public.profil_coach_courant_id() to authenticated;

-- Le coach connecté, en espace coach, écrit, lit et retire dans SON dossier seulement. La lecture
-- par un client (URL signée d'un média d'une séance à laquelle il a accès) arrive en P6.4.
create policy medias_programmes_insert_coach
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'medias-programmes'
    and public.profil_actif_courant() = 'coach'
    and (storage.foldername(name))[1] = public.profil_coach_courant_id()::text
  );

create policy medias_programmes_select_coach
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'medias-programmes'
    and (storage.foldername(name))[1] = public.profil_coach_courant_id()::text
  );

create policy medias_programmes_delete_coach
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'medias-programmes'
    and (storage.foldername(name))[1] = public.profil_coach_courant_id()::text
  );

create table public.medias (
  id uuid primary key default gen_random_uuid(),
  profil_coach_id uuid not null references public.profils_coach (id) on delete cascade,
  chemin text not null unique,
  nom_fichier text not null,
  type_mime text not null,
  poids_octets integer not null,
  cree_le timestamptz not null default now()
);
create index medias_profil_coach_idx on public.medias (profil_coach_id);
alter table public.medias enable row level security;
revoke all on public.medias from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.medias to service_role;

alter table public.exercices
  add column media_id uuid references public.medias (id) on delete set null;

create or replace function public.enregistrer_media(
  p_chemin text,
  p_nom_fichier text,
  p_type_mime text,
  p_poids_octets integer
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
revoke execute on function public.enregistrer_media(text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_media(text, text, text, integer) to authenticated;

create or replace function public.mes_medias()
returns table (
  id uuid,
  chemin text,
  nom_fichier text,
  type_mime text,
  poids_octets integer
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
revoke execute on function public.mes_medias()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_medias() to authenticated;

create or replace function public.supprimer_media(p_media_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.supprimer_media(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_media(uuid) to authenticated;

create or replace function public.joindre_media(p_exercice_id uuid, p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'non_implemente';
end;
$$;
revoke execute on function public.joindre_media(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.joindre_media(uuid, uuid) to authenticated;
