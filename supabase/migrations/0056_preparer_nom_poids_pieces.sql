-- Nom et poids d'une pièce de vérification -- DÉCOR (12 novembre 2026, L2-06 : la ligne
-- « Déposée » affiche « Coche, nom du fichier, date de dépôt, poids » ; décision du développeur :
-- « la fiche les demande, fais-le »).
--
-- Cette migration pose les deux colonnes, sans aucun droit ; 0057 les ouvre au coach. Même
-- découpe que 0052/0053 : le banc doit rougir sur une assertion, jamais sur un objet absent.
--
-- Facultatives : les pièces déposées avant cette date n'en ont pas, et l'écran les montre alors
-- sans nom ni poids. Le nom de fichier peut dire qui est la personne (« passeport-prenom-nom ») :
-- il reste lisible par le seul propriétaire (politique de 0012) et par l'examinateur (0013), et
-- n'entre jamais dans un journal (fiche L2-06, critère 7).
alter table public.pieces_verification
  add column nom_fichier text,
  add column taille_octets bigint;

alter table public.pieces_verification
  add constraint pieces_verification_nom_fichier_longueur
  check (nom_fichier is null or char_length(nom_fichier) between 1 and 255);

alter table public.pieces_verification
  add constraint pieces_verification_taille_positive
  check (taille_octets is null or taille_octets >= 0);
