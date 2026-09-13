-- Defaut herite de L1/L2, trouve en ecrivant la fonction de recherche de L3 (13 septembre 2026) :
-- docs/domaine.md §3.2 specifie "formats ⊆ {visio, presentiel}" depuis toujours, mais aucune
-- migration n'a jamais cree cette colonne sur profils_coach -- ni ailleurs. Corrige ici, en
-- schema seul : AUCUN ecran de ce depot n'ecrit encore cette colonne (ni commune_base_insee,
-- deja existante mais jamais renseignee non plus) -- le formulaire qui les recueille (L1-09 ou
-- L2-05) reste une dette explicite (docs/dette.md), pas construit par cette migration ni par le
-- lot L3. La fonction de recherche de L3 lit la colonne correctement des qu'elle existe, meme si
-- elle reste vide pour tout coach reel tant que ce formulaire n'existe pas.

alter table public.profils_coach add column formats text[] not null default '{}';

-- Deux valeurs possibles, jamais plus -- meme esprit que la contrainte de disciplines (0020),
-- appliquee ici en ligne (check) plutot que par une table de reference : contrairement au
-- catalogue de disciplines, cet ensemble est une dichotomie structurelle du produit
-- (docs/domaine.md §3.2), pas un catalogue destine a grandir.
alter table public.profils_coach
  add constraint profils_coach_formats_valides
  check (formats <@ array['visio', 'presentiel']::text[]);

-- Meme mecanique que 0016_ajouter_parcours_coach.sql : un GRANT est table-large par defaut,
-- revoke puis regrant colonne par colonne pour inclure la nouvelle colonne exactement ou les
-- autres le sont deja -- publique une fois le profil verifiee (profils_coach_select_verifiee,
-- 0008), editable par le proprietaire (meme regle que titre_court/bio/commune_base_insee).
revoke all on public.profils_coach from anon, authenticated;

grant select (
  id, prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee,
  statut_verification, cree_le, parcours_texte, langues, formats
) on public.profils_coach to anon, authenticated;

grant insert on public.profils_coach to authenticated;
grant update (
  prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee, parcours_texte,
  langues, formats
) on public.profils_coach to authenticated;
