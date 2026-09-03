-- Corrige une hypothese fausse du commentaire de fin de 0001_creer_identite.sql : "service_role
-- n'a besoin d'aucun grant explicite : il contourne RLS et a deja acces a tout le schema public
-- par defaut sur un projet Supabase". Verifiee pour la premiere fois en conditions reelles par
-- le banc RLS (docs/prompts/L1.md, P1.5) contre le projet de developpement : FAUX sur ce
-- projet, et ce n'est pas un accident de configuration.
--
-- supabase/config.toml : "auto_expose_new_tables" est desactive (nouveau defaut cloud) — aucune
-- relation n'est reachable par l'API Data (PostgREST) sans GRANT explicite, quel que soit le
-- role, y compris service_role. C'est le meme reglage que CLAUDE.md §2 fixe volontairement pour
-- anon et authenticated ; il s'applique tout autant a service_role, que 0001 n'avait pas
-- accorde. 0001_creer_identite.sql n'est pas modifie (deja appliquee en dev, docs/backend.md
-- §2 : une correction s'ecrit dans une nouvelle migration, jamais en editant l'ancienne).
--
-- Contourner RLS (ce que service_role fait deja au niveau Postgres) et avoir le droit d'utiliser
-- une table via PostgREST sont deux mecanismes distincts : le premier ne dispense pas du second.
--
-- Perimetre des grants : exactement ce dont un appelant service_role legitime a besoin
-- aujourd'hui — src/test/rls.banc.ts, qui l'utilise pour deux choses seulement : relire un etat
-- de controle independant de la politique testee (SELECT), et preparer le profil coach de B
-- avant que creer_profil_coach (fonction SECURITY DEFINER, lot L2) n'existe (INSERT sur
-- profils_coach). Ni UPDATE ni DELETE : aucun appelant service_role legitime n'en a besoin a ce
-- lot ; le jour ou un aura besoin, ce sera une nouvelle migration, avec sa propre justification.
grant select on public.comptes to service_role;
grant select, insert on public.profils_client to service_role;
grant select, insert on public.profils_coach to service_role;
grant select, insert on public.consentements to service_role;
grant select on public.consentements_courants to service_role;
