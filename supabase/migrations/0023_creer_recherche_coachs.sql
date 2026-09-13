-- P3.2 (docs/prompts/L3.md) : la fonction de recherche et de classement, mecanisme valide en
-- P3.1/L3-02 (docs/ecrans/L3-02-recherche-filtres.md) -- security invoker, plafond dur, bruit
-- de departage tire a chaque requete, total exact expose, enumeration complete assumee.

-- ---------------------------------------------------------------------------------------------
-- Referentiel geographique reduit (docs/ecrans/L3-02, "Referentiel geographique")
-- ---------------------------------------------------------------------------------------------

-- Sous-ensemble reduit aux six communes du jeu de demonstration, pas le referentiel INSEE
-- national complet (decide le 13 septembre 2026) -- le filtre de commune de L3-02 est donc un
-- choix ferme parmi ces six villes, jamais un champ texte libre. Source : geo.api.gouv.fr
-- (IGN/INSEE, ecosysteme data.gouv.fr/Etalab), interrogee le 13 septembre 2026 -- jamais saisie
-- de memoire.
create table public.communes_reference (
  code_insee text primary key,
  nom text not null,
  latitude double precision not null,
  longitude double precision not null
);

insert into public.communes_reference (code_insee, nom, latitude, longitude) values
  ('69123', 'Lyon', 45.7580, 4.8351),
  ('75056', 'Paris', 48.8589, 2.3470),
  ('33063', 'Bordeaux', 44.8624, -0.5848),
  ('44109', 'Nantes', 47.2382, -1.5603),
  ('59350', 'Lille', 50.6311, 3.0468),
  ('31555', 'Toulouse', 43.6007, 1.4328);

alter table public.communes_reference enable row level security;

-- Lecture publique, meme statut que disciplines (0020) : donnee non sensible, aucune ecriture
-- depuis l'application.
revoke all on public.communes_reference from anon, authenticated;
grant select on public.communes_reference to anon, authenticated;

create policy communes_reference_select_public
  on public.communes_reference for select
  to anon, authenticated
  using (true);

-- Meme trou que 0009/0010/0014/0021 -- ce projet n'accorde jamais rien a service_role par
-- defaut. Select seul : le banc n'a besoin que de lire cette table, jamais d'y ecrire (six
-- lignes fixes, pas de fixture ephemere a preparer ici).
grant select on public.communes_reference to service_role;

-- ---------------------------------------------------------------------------------------------
-- rechercher_coachs(...) -- la fonction de recherche et de classement
-- ---------------------------------------------------------------------------------------------

-- SECURITY INVOKER, pas DEFINER (docs/backend.md §10, tranche en tete de docs/prompts/L3.md) :
-- toutes les colonnes lues ici sont deja accordees a anon/authenticated par des politiques
-- eprouvees au banc (offres_select_publiees, profils_coach_select_verifiee, 0008) ou par des
-- GRANT publics de ce meme lot (disciplines, communes_reference) -- aucun privilege
-- supplementaire n'est necessaire, donc ce sont ces politiques, appliquees avec les droits reels
-- de l'appelant, qui ferment la fonction. `language sql` : une seule requete, aucune branche de
-- controle -- pas besoin de plpgsql.
create or replace function public.rechercher_coachs(
  p_discipline text default null,
  p_texte text default null,
  p_commune_insee text default null,
  p_format text default null,
  p_prix_min integer default null,
  p_prix_max integer default null,
  p_limite integer default 20,
  p_decalage integer default 0
)
returns table (
  offre_id uuid,
  coach_id uuid,
  prenom text,
  nom text,
  photo_url text,
  discipline text,
  titre_court text,
  commune_base_insee text,
  formats text[],
  titre text,
  prix_centimes integer,
  total_resultats bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidats as (
    select
      o.id as offre_id,
      pc.id as coach_id,
      pc.prenom,
      pc.nom,
      pc.photo_url,
      pc.discipline,
      pc.titre_court,
      pc.commune_base_insee,
      pc.formats,
      o.titre,
      o.prix_centimes,
      -- Correspondance textuelle (docs/domaine.md §5.6) : seulement pertinente en recherche
      -- libre (p_discipline null) -- exact d'abord (la discipline du coach correspond au texte
      -- tape mot pour mot), puis partiel (titre_court), puis bio seule. Toujours 0 quand
      -- p_discipline est fourni : la discipline est alors un FILTRE, deja applique plus bas,
      -- rien a departager ici.
      case
        when p_discipline is not null or p_texte is null then 0
        when pc.discipline ilike p_texte then 3
        when pc.titre_court ilike '%' || p_texte || '%' then 2
        when pc.bio ilike '%' || p_texte || '%' then 1
        else 0
      end as correspondance_texte,
      -- Complétude du profil (docs/domaine.md §5.6, seuils par champ) : bio/parcours >= 80
      -- caractères, photo présente -- jamais un simple "renseigné/vide".
      (
        (case when length(coalesce(pc.bio, '')) >= 80 then 1 else 0 end) +
        (case when length(coalesce(pc.parcours_texte, '')) >= 80 then 1 else 0 end) +
        (case when pc.photo_url is not null then 1 else 0 end)
      ) as completude,
      -- Proximité géographique (docs/domaine.md §5.7) : 1,0 à 0 km → 0 à 25 km ; "visio" = 0,6
      -- fixe, quelle que soit la commune demandée ; 0 par défaut (aucune commune demandée, ou
      -- coordonnées absentes d'un des deux côtés — comportement neutre, jamais une erreur).
      case
        when 'visio' = any(pc.formats) then 0.6
        when p_commune_insee is not null
          and cr_coach.latitude is not null
          and cr_demande.latitude is not null
        then greatest(
          0,
          1 - (
            2 * 6371 * asin(sqrt(
              sin(radians(cr_coach.latitude - cr_demande.latitude) / 2) ^ 2
              + cos(radians(cr_demande.latitude)) * cos(radians(cr_coach.latitude))
                * sin(radians(cr_coach.longitude - cr_demande.longitude) / 2) ^ 2
            ))
          ) / 25.0
        )
        else 0
      end as proximite
    from public.offres o
    join public.profils_coach pc on pc.id = o.coach_id
    left join public.communes_reference cr_coach on cr_coach.code_insee = pc.commune_base_insee
    left join public.communes_reference cr_demande on cr_demande.code_insee = p_commune_insee
    where
      -- Même fermeture que offres_select_publiees / profils_coach_select_verifiee (0008) : un
      -- coach non vérifié ou une offre non publiée n'apparaît jamais, même partiellement.
      o.publiee_le is not null
      and o.retiree_le is null
      and pc.statut_verification = 'verifiee'
      -- Discipline demandée : FILTRE, pas seulement un critère de tri (docs/domaine.md §5.6).
      and (p_discipline is null or pc.discipline = p_discipline)
      and (
        p_discipline is not null
        or p_texte is null
        or pc.discipline ilike '%' || p_texte || '%'
        or pc.titre_court ilike '%' || p_texte || '%'
        or pc.bio ilike '%' || p_texte || '%'
      )
      and (p_format is null or p_format = any(pc.formats))
      and (p_prix_min is null or o.prix_centimes >= p_prix_min)
      and (p_prix_max is null or o.prix_centimes <= p_prix_max)
  )
  select
    offre_id, coach_id, prenom, nom, photo_url, discipline, titre_court, commune_base_insee,
    formats, titre, prix_centimes,
    -- Total exact sur l'ENSEMBLE des candidats, calculé avant que LIMIT/OFFSET ne tronquent —
    -- décision validée de L3-02 : l'énumération complète est assumée, le total est exposé.
    count(*) over () as total_resultats
  from candidats
  order by
    correspondance_texte desc,
    proximite desc,
    completude desc,
    -- Bruit de départage (docs/backend.md §10) : tiré à l'EXÉCUTION de cette requête précise,
    -- jamais mémorisé, jamais reçu en paramètre, jamais dérivable d'une valeur que l'appelant
    -- contrôle — seul ce qui précède dans cet ORDER BY est déterministe.
    random()
  -- Plafond dur (docs/backend.md §10) : indépendant de ce que l'appelant demande.
  limit least(coalesce(p_limite, 20), 30)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

revoke execute on function public.rechercher_coachs(
  text, text, text, text, integer, integer, integer, integer
) from public;
grant execute on function public.rechercher_coachs(
  text, text, text, text, integer, integer, integer, integer
) to anon, authenticated;
