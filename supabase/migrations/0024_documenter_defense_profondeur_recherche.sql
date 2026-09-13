-- Decision du 13 septembre 2026, apres les douze cycles casser/restaurer de P3.3
-- (docs/prompts/L3.md) : deux filtres du corps de rechercher_coachs (statut_verification,
-- publiee_le/retiree_le) sont redondants avec des politiques deja prouvees rouges au banc
-- (offres_select_publiees, profils_coach_select_verifiee, 0008) tant que cette fonction reste
-- `security invoker` -- aucun cycle de cassage ne les a fait rougir, la politique filtre deja
-- ces lignes avant que ce SQL ne les voie. Garde les deux, comme defense en profondeur -- ne les
-- retire pas en les croyant inutiles. Ce fichier ajoute seulement les commentaires qui
-- expliquent pourquoi, plus la fonction d'introspection qui rend la bascule invoker/definer
-- verifiable (voir plus bas), jamais supposee.

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
      -- DÉFENSE EN PROFONDEUR, pas une garantie exercée directement : redondant avec
      -- offres_select_publiees (0008, EXISTS sur profils_coach.statut_verification =
      -- 'verifiee') tant que cette fonction reste `security invoker` (docs/backend.md §10) —
      -- la politique filtre déjà ces lignes avant que ce SQL ne les voie. Vérifié par cassage
      -- (docs/prompts/L3.md, P3.3, 13 septembre 2026) : retirer CETTE ligne, seule, ne fait
      -- rougir aucun test — le banc reste entièrement vert, parce que le rouge attendu vient
      -- de la politique, pas d'ici. **Si cette fonction passe un jour en `security definer`,
      -- cette ligne redevient la SEULE protection contre une offre non publiée ou retirée** —
      -- ne pas la retirer en la croyant mort. `rechercher_coachs_est_invoker()` (plus bas) rend
      -- cette bascule vérifiable, jamais supposée.
      o.publiee_le is not null
      and o.retiree_le is null
      -- DÉFENSE EN PROFONDEUR, même raisonnement : redondant avec profils_coach_select_verifiee
      -- (0008) tant que security invoker tient — cassé isolément en P3.3, aucun rouge (même
      -- constat que ci-dessus). En `security definer`, cette ligne redeviendrait la SEULE
      -- protection contre un coach non vérifié.
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

-- Repris tel quel de 0023 : CREATE OR REPLACE preserve les privileges deja accordes (Postgres
-- ne les reinitialise pas), donc ces deux lignes sont fonctionnellement redondantes ici -- mais
-- src/test/fonctions-execute-revoque.test.ts (docs/backend.md §4) verifie CHAQUE fichier de
-- migration independamment, pour qu'un relecteur n'ait jamais a faire confiance a "deja revoque
-- ailleurs". Repetees a chaque redefinition de la fonction, pas une seule fois pour toutes.
revoke execute on function public.rechercher_coachs(
  text, text, text, text, integer, integer, integer, integer
) from public;
grant execute on function public.rechercher_coachs(
  text, text, text, text, integer, integer, integer, integer
) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- rechercher_coachs_est_invoker() -- rend la bascule invoker/definer vérifiable (règle 8)
-- ---------------------------------------------------------------------------------------------

-- Règle 8 (docs/prompts/L2.md, reprise docs/prompts/L3.md) : un test qui deviendra faux plus
-- tard porte son intention dans le fichier. Les deux filtres redondants ci-dessus ne sont sûrs
-- QUE tant que rechercher_coachs reste security invoker -- rien, jusqu'ici, ne signalerait
-- qu'elle a basculé en security definer un jour (par erreur, ou par une future modification qui
-- oublie ce fichier). Cette fonction lit pg_proc.prosecdef, jamais devinée ni recopiée à la
-- main : elle interroge le catalogue système réel, pour le coach_id qui compte ici precisement.
-- Lecture seule d'un fait sur une définition de fonction -- aucune donnée sensible, sûre à
-- exposer publiquement.
create or replace function public.rechercher_coachs_est_invoker()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select not prosecdef
  from pg_proc
  where proname = 'rechercher_coachs' and pronamespace = 'public'::regnamespace;
$$;

revoke execute on function public.rechercher_coachs_est_invoker() from public;
grant execute on function public.rechercher_coachs_est_invoker() to anon, authenticated;
