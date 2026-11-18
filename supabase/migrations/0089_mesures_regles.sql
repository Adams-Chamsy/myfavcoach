-- L7, P7.2 — les règles des mesures corporelles (décor : 0088). docs/domaine.md §3.7 ;
-- docs/ecrans/L7-06-suivi.md ; docs/prompts/L7.md (décision 1 : aucun coach ne les lit).
--
-- Trois fonctions, le client désigné par sa session et son espace client actif
-- (mon_profil_client_en_espace_client, 0085 ; CLAUDE.md §10) — aucune ne prend d'identifiant de
-- client en paramètre. Ordre des contrôles : espace client, consentement, saisie, clé.
-- Codes de refus : profil_client_requis, consentement_sante_absent, mesure_invalide,
-- cle_idempotence_reutilisee.

create or replace function public.consentement_sante_accorde()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.consentements_courants
     where compte_id = auth.uid() and type = 'donneesSante' and accorde
  );
$$;
revoke execute on function public.consentement_sante_accorde()
  from public, anon, authenticated, service_role;

-- p_valeur : kg ou cm, une décimale au plus. Refusée si absente, non finie (NaN, ±Infinity),
-- nulle ou négative, avec plus d'une décimale, ou au-delà du plafond technique de 1 000
-- (borne incluse). Les seuils de confirmation (20–300 kg, 40–200 cm) ne refusent rien.
--
-- p_cle : la clé de réessai, tirée par l'application à l'appui sur « Enregistrer ». Elle est
-- d'abord inscrite dans cles_mesures (« on conflict do nothing ») : deux requêtes concurrentes
-- avec la même clé se sérialisent sur cette clé primaire, la seconde attend la première et la
-- trouve. Même clé, même type, même valeur : la mesure déjà enregistrée est rendue. Même clé et
-- autre chose — ou une mesure effacée depuis (la clé reste, la ligne non) : refus.
create or replace function public.enregistrer_mesure(p_type text, p_valeur numeric, p_cle uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_client_en_espace_client();
  v_valeur integer;
  v_id uuid;
  v_nouvelle integer;
begin
  if not public.consentement_sante_accorde() then
    raise exception 'consentement_sante_absent';
  end if;
  if p_type is null or p_type not in ('poids', 'tour_de_taille')
     or p_valeur is null or p_cle is null
     or p_valeur in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
     or p_valeur <= 0 or p_valeur > 1000
     or p_valeur <> round(p_valeur, 1) then
    raise exception 'mesure_invalide';
  end if;
  v_valeur := (p_valeur * case p_type when 'poids' then 1000 else 10 end)::integer;

  insert into public.cles_mesures (profil_client_id, cle)
  values (v_profil, p_cle)
  on conflict do nothing;
  get diagnostics v_nouvelle = row_count;

  if v_nouvelle = 0 then
    select id into v_id
      from public.mesures_corporelles
     where profil_client_id = v_profil and cle = p_cle
       and type = p_type and valeur = v_valeur;
    if v_id is null then
      raise exception 'cle_idempotence_reutilisee';
    end if;
    return v_id;
  end if;

  insert into public.mesures_corporelles (profil_client_id, type, valeur, mesuree_le, cle)
  values (v_profil, p_type, v_valeur, (now() at time zone 'Europe/Paris')::date, p_cle)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.enregistrer_mesure(text, numeric, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_mesure(text, numeric, uuid) to authenticated;

-- La série d'un type : première et dernière par date, puis par ordre d'enregistrement ; valeurs
-- rendues en kg / cm. null : aucune mesure de ce type. Le poids de départ de l'onboarding
-- (profils_client) n'en fait pas partie : il n'a pas de date (revue du 18 novembre 2026).
create or replace function public.serie_mesures(p_profil uuid, p_type text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with liste as (
    select valeur, mesuree_le,
           row_number() over (order by mesuree_le, enregistree_le, id) as rang_debut,
           row_number() over (order by mesuree_le desc, enregistree_le desc, id desc) as rang_fin,
           count(*) over () as nombre
      from public.mesures_corporelles
     where profil_client_id = p_profil and type = p_type
  ),
  bornes as (
    select max(valeur) filter (where rang_debut = 1) as v_premiere,
           max(mesuree_le) filter (where rang_debut = 1) as le_premiere,
           max(valeur) filter (where rang_fin = 1) as v_derniere,
           max(mesuree_le) filter (where rang_fin = 1) as le_derniere,
           max(nombre) as nombre
      from liste
  ),
  facteur as (select case p_type when 'poids' then 1000.0 else 10.0 end as f)
  select case when b.nombre is null then null else jsonb_build_object(
    'premiere', jsonb_build_object('valeur', round(b.v_premiere / f.f, 1), 'le', b.le_premiere),
    'derniere', jsonb_build_object('valeur', round(b.v_derniere / f.f, 1), 'le', b.le_derniere),
    'ecart', round((b.v_derniere - b.v_premiere) / f.f, 1),
    'nombre', b.nombre
  ) end
  from bornes b, facteur f;
$$;
revoke execute on function public.serie_mesures(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.mes_mesures()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_client_en_espace_client();
begin
  if not public.consentement_sante_accorde() then
    raise exception 'consentement_sante_absent';
  end if;
  return jsonb_build_object(
    'poids', public.serie_mesures(v_profil, 'poids'),
    'tour_de_taille', public.serie_mesures(v_profil, 'tour_de_taille'),
    'seuils', jsonb_build_object(
      'poids', jsonb_build_object('min', 20, 'max', 300),
      'tour_de_taille', jsonb_build_object('min', 40, 'max', 200)
    )
  );
end;
$$;
revoke execute on function public.mes_mesures()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_mesures() to authenticated;

-- Permis consentement retiré : c'est après un retrait qu'on l'offre (L1-09). Les clés de
-- réessai restent, sans valeur ni type : un réessai arrivé après l'effacement ne recrée rien.
create or replace function public.effacer_mes_mesures()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profil uuid := public.mon_profil_client_en_espace_client();
begin
  update public.profils_client
     set poids_depart_grammes = null, poids_cible_grammes = null
   where id = v_profil;
  delete from public.mesures_corporelles where profil_client_id = v_profil;
end;
$$;
revoke execute on function public.effacer_mes_mesures()
  from public, anon, authenticated, service_role;
grant execute on function public.effacer_mes_mesures() to authenticated;
