-- L2-14 (onglet Parcours du profil coach public) : docs/domaine.md §3.2 cite deja `langues`
-- parmi les champs du profil coach ; `parcours_texte` est laisse a l'implementation par la
-- fiche elle-meme ("la colonne qui porte ce texte libre... non tranchee"). Texte libre unique
-- (pas de diplomes/chronologie/methode structures -- simplification assumee, voir L2-14 et
-- docs/dette.md), meme esprit que titre_court/bio : editable par le coach, public une fois
-- verifiee comme le reste du profil.
alter table public.profils_coach add column parcours_texte text;
alter table public.profils_coach add column langues text[] not null default '{}';

-- Meme mecanique que 0008_politiques_offres.sql : un GRANT est table-large par defaut, revoke
-- puis regrant colonne par colonne pour inclure les deux nouvelles colonnes exactement ou
-- titre_court/bio le sont deja -- publiques une fois le profil verifiee (profils_coach_select_verifiee,
-- 0008), editables par le proprietaire (meme regle que titre_court/bio).
revoke all on public.profils_coach from anon, authenticated;

grant select (
  id, prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee,
  statut_verification, cree_le, parcours_texte, langues
) on public.profils_coach to anon, authenticated;

grant insert on public.profils_coach to authenticated;
grant update (
  prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee, parcours_texte, langues
) on public.profils_coach to authenticated;
