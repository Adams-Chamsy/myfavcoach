-- Corrige un défaut de 0026, trouvé en poussant la migration et en relançant le banc RLS
-- (rouge massif : "null value in column jeton_invitation... violates not-null constraint") --
-- pas édité dans 0026 elle-même, déjà appliquée en dev (docs/backend.md §2, "aucune migration
-- n'est modifiée après avoir été appliquée").
--
-- 0026 a bien mis jeton_invitation à NOT NULL après avoir backfillé les lignes EXISTANTES, mais
-- n'a jamais posé de DEFAULT -- toute nouvelle ligne profils_coach (creer_profil_coach, 0005 ;
-- et toute insertion directe du banc) échouait donc, faute d'une valeur fournie explicitement
-- par un appelant qui n'a aucune raison d'en connaître le mécanisme.
alter table public.profils_coach
  alter column jeton_invitation
  set default translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_');
