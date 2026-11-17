-- L6, P6.3 — les règles de la bibliothèque de médias (décor : 0082). docs/prompts/L6.md,
-- décision 8 ; docs/ecrans/L6-11-studio.md, « Bibliothèque ».
--
-- Le fichier est envoyé par l'application dans le dossier privé du coach (politiques de
-- storage.objects, 0082), puis enregistré ici : le serveur vérifie que l'objet existe, qu'il est
-- dans le dossier du coach connecté, son type et son poids. Lu seulement par URL signée.

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
declare
  v_coach uuid := public.mon_profil_coach_en_espace_coach();
  v_id uuid;
begin
  if p_chemin is null or split_part(p_chemin, '/', 1) <> v_coach::text
     or p_type_mime not in ('image/jpeg', 'image/png', 'video/mp4', 'application/pdf')
     or p_poids_octets is null or p_poids_octets < 1 or p_poids_octets > 52428800
     or p_nom_fichier is null or btrim(p_nom_fichier) = '' or length(p_nom_fichier) > 200
     or not exists (
       select 1 from storage.objects
        where bucket_id = 'medias-programmes' and name = p_chemin
     ) then
    raise exception 'media_invalide';
  end if;
  insert into public.medias (profil_coach_id, chemin, nom_fichier, type_mime, poids_octets)
  values (v_coach, p_chemin, btrim(p_nom_fichier), p_type_mime, p_poids_octets)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.mes_medias()
returns table (
  id uuid,
  chemin text,
  nom_fichier text,
  type_mime text,
  poids_octets integer
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.chemin, m.nom_fichier, m.type_mime, m.poids_octets
    from public.medias m
   where m.profil_coach_id = public.mon_profil_coach_en_espace_coach()
   order by m.cree_le desc;
$$;

-- Rend le chemin, pour que l'application retire le fichier du dossier. Refusé si un programme
-- publié ou archivé s'en sert : ses abonnés le perdraient sans que rien ne le dise.
create or replace function public.supprimer_media(p_media_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_media public.medias;
begin
  select * into v_media from public.medias
   where id = p_media_id and profil_coach_id = public.mon_profil_coach_en_espace_coach();
  if v_media.id is null then
    raise exception 'media_introuvable';
  end if;
  if exists (
    select 1 from public.exercices e
      join public.seances s on s.id = e.seance_id
      join public.programmes p on p.id = s.programme_id
     where e.media_id = v_media.id and p.statut <> 'brouillon'
  ) then
    raise exception 'media_utilise';
  end if;
  delete from public.medias where id = v_media.id;
  return v_media.chemin;
end;
$$;

-- Joint un média du coach à un exercice d'un brouillon ; p_media_id nul : le retire.
create or replace function public.joindre_media(p_exercice_id uuid, p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seance_id uuid;
begin
  select seance_id into v_seance_id from public.exercices where id = p_exercice_id;
  if v_seance_id is null then
    raise exception 'exercice_introuvable';
  end if;
  perform public.ma_seance_en_brouillon(v_seance_id);
  if p_media_id is not null and not exists (
    select 1 from public.medias
     where id = p_media_id and profil_coach_id = public.mon_profil_coach_en_espace_coach()
  ) then
    raise exception 'media_introuvable';
  end if;
  update public.exercices set media_id = p_media_id where id = p_exercice_id;
end;
$$;

-- exercices_de_la_seance (0081) rend désormais le média joint.
drop function public.exercices_de_la_seance(uuid);
create function public.exercices_de_la_seance(p_seance_id uuid)
returns table (
  id uuid,
  ordre smallint,
  nom text,
  series smallint,
  repetitions smallint,
  charge_grammes integer,
  consigne text,
  media_id uuid,
  media_chemin text,
  media_type_mime text,
  media_nom_fichier text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.seances s
      join public.programmes p on p.id = s.programme_id
     where s.id = p_seance_id
       and p.profil_coach_id = public.mon_profil_coach_en_espace_coach()
  ) then
    raise exception 'seance_introuvable';
  end if;
  return query
  select e.id, e.ordre, e.nom, e.series, e.repetitions, e.charge_grammes, e.consigne,
         m.id, m.chemin, m.type_mime, m.nom_fichier
    from public.exercices e
    left join public.medias m on m.id = e.media_id
   where e.seance_id = p_seance_id
   order by e.ordre;
end;
$$;

revoke execute on function public.enregistrer_media(text, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_media(text, text, text, integer) to authenticated;
revoke execute on function public.mes_medias() from public, anon, authenticated, service_role;
grant execute on function public.mes_medias() to authenticated;
revoke execute on function public.supprimer_media(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_media(uuid) to authenticated;
revoke execute on function public.joindre_media(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.joindre_media(uuid, uuid) to authenticated;
revoke execute on function public.exercices_de_la_seance(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.exercices_de_la_seance(uuid) to authenticated;
