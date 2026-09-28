-- Rectifie, là où le SQL se lit, une affirmation fausse de l'en-tête de
-- 0034_creer_cles_idempotence.sql (déjà appliquée, donc jamais modifiée — docs/backend.md §2).
--
-- L'en-tête de 0034 dit qu'un appel sous le rôle de service « lèverait non_authentifie ». Faux,
-- constaté au banc en P4.3 : 0034 n'accorde EXECUTE qu'à authenticated, donc un appel sous le
-- rôle de service est refusé PAR LE GRANT (« permission denied »), avant la première ligne de la
-- fonction. La garde non_authentifie reste une seconde barrière, qu'aucun appel PostgREST ne
-- peut atteindre (anon n'a pas EXECUTE ; authenticated a toujours un auth.uid()).
--
-- Pourquoi un COMMENT ON FUNCTION plutôt qu'une note ailleurs : il s'attache à l'objet lui-même
-- et se lit là où l'on inspecte la base (\df+ dans psql, tableau de bord Supabase, tout outil qui
-- lit pg_description) — quelqu'un qui lit la fonction vivante tombe dessus sans avoir ouvert ni
-- 0034 ni docs/backend.md. Et ce fichier, numéroté juste après 0034, est le premier que lit
-- quelqu'un qui parcourt les migrations dans l'ordre. Aucun droit, aucun corps de fonction ne
-- change ici.

comment on function public.reserver_cle_idempotence(uuid, text, text) is
  'Réserve une clé d''idempotence pour le compte appelant (docs/backend.md §13). À appeler avec '
  'le jeton de session DU CLIENT, jamais avec la clé du rôle de service : seul authenticated a '
  'EXECUTE, un appel sous le rôle de service est refusé par le grant (et non par la garde '
  'non_authentifie, inatteignable par PostgREST — l''en-tête de 0034 le disait à tort, rectifié '
  'par 0035). États rendus : nouvelle, reprise (en_cours abandonné depuis plus de 5 minutes), '
  'en_cours, rejouee ; exception cle_idempotence_reutilisee si la même clé porte une autre '
  'requête.';

comment on function public.terminer_cle_idempotence(uuid, int, jsonb) is
  'Termine une clé d''idempotence réservée par le compte appelant et mémorise la réponse à '
  'rejouer (docs/backend.md §13). Même appelant que reserver_cle_idempotence : jeton de session '
  'du client, seul authenticated a EXECUTE. Exception cle_idempotence_inconnue si la clé n''est '
  'pas en cours pour ce compte.';
