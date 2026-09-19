-- Généralise la correction de 0030 à TOUT le dépôt, plutôt que de la laisser propre à L3bis.
--
-- 0030 a fermé un trou trouvé par la CI (pile fraîche) sur les cinq fonctions de L3bis :
-- `revoke execute ... from public` seul ne retire pas un grant SÉPARÉ posé directement à un
-- rôle nommé, sur une pile dont le baseline en accorde un (la pile Supabase LOCALE, jamais le
-- projet distant partagé — 0006, commentaire de tête, déjà documenté pour anon/authenticated
-- sur les TABLES). En écrivant un test qui balaie systématiquement supabase/migrations/
-- (src/test/conventions-grants-migrations.test.ts) plutôt que de compter sur la mémoire pour
-- répéter la correction lot par lot, ce même trou est apparu sur SEIZE autres fonctions,
-- toutes créées avant L3bis (0002 à 0024) : chacune ne révoque explicitement que `public`, ou
-- `public, anon, authenticated` sans `service_role` -- jamais les quatre rôles à la fois.
-- Aucune n'a jamais mordu en pratique (aucun test n'appelle ces fonctions en `service_role`,
-- contrairement à `invitations` où le banc le fait pour préparer ses fixtures) -- ce qui
-- explique pourquoi ce trou est resté invisible seize fois de suite plutôt que révélé par un
-- rouge CI comme pour L3bis. Corrigé une bonne fois, pour tout le dépôt, avant L4.
--
-- Convention (rappelée de 0006, étendue le 19 septembre 2026) : revoke EXPLICITEMENT
-- public, anon, authenticated ET service_role avant tout grant à anon ou authenticated -- jamais
-- "from public" seul, jamais "from public, anon, authenticated" sans service_role.

revoke execute on function public.profil_actif_courant()
  from public, anon, authenticated, service_role;
grant execute on function public.profil_actif_courant() to authenticated;

revoke execute on function public.basculer_profil(public.profil_actif_enum)
  from public, anon, authenticated, service_role;
grant execute on function public.basculer_profil(public.profil_actif_enum) to authenticated;

revoke execute on function public.creer_profil_coach(text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_profil_coach(text, text, text, text) to authenticated;

revoke execute on function public.publier_offre(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.publier_offre(uuid) to authenticated;

revoke execute on function public.retirer_offre(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retirer_offre(uuid) to authenticated;

revoke execute on function public.mon_profil_coach_id()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_profil_coach_id() to authenticated;

revoke execute on function public.nouveau_chemin_stockage()
  from public, anon, authenticated, service_role;
grant execute on function public.nouveau_chemin_stockage() to authenticated;

revoke execute on function public.supprimer_mon_compte(text)
  from public, anon, authenticated, service_role;
grant execute on function public.supprimer_mon_compte(text) to authenticated;

revoke execute on function public.demander_export_donnees()
  from public, anon, authenticated, service_role;
grant execute on function public.demander_export_donnees() to authenticated;

revoke execute on function public.decider_verification_coach(
  uuid, public.statut_verification_enum, text
) from public, anon, authenticated, service_role;
grant execute on function public.decider_verification_coach(
  uuid, public.statut_verification_enum, text
) to authenticated;

revoke execute on function public.est_examinateur_courant()
  from public, anon, authenticated, service_role;
grant execute on function public.est_examinateur_courant() to authenticated;

revoke execute on function public.pieces_verification_pour_examinateur()
  from public, anon, authenticated, service_role;
grant execute on function public.pieces_verification_pour_examinateur() to authenticated;

revoke execute on function public.date_verification_coach(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.date_verification_coach(uuid) to anon, authenticated;

revoke execute on function public.rechercher_coachs(
  text, text, text, text, integer, integer, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.rechercher_coachs(
  text, text, text, text, integer, integer, integer, integer
) to anon, authenticated;

revoke execute on function public.rechercher_coachs_est_invoker()
  from public, anon, authenticated, service_role;
grant execute on function public.rechercher_coachs_est_invoker() to anon, authenticated;

revoke execute on function public.coach_par_jeton_invitation(text)
  from public, anon, authenticated, service_role;
grant execute on function public.coach_par_jeton_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- demandes_export (0018, L2-04) : seule table créée sans AUCUN grant service_role -- règle 11
-- (docs/prompts/L3bis.md), trouvée une sixième fois, cette fois par le même balayage plutôt que
-- par hasard. Aucun mécanisme actuel n'y écrit en service_role (l'insertion passe par
-- demander_export_donnees(), SECURITY DEFINER, qui s'exécute avec les privilèges du propriétaire
-- de la fonction, pas de service_role -- voir docs/dette.md, "demandes_export ne transitionne
-- jamais vers prêt") : SELECT seul, comme decisions_verification/consentements_courants/
-- communes_reference/langues, qui n'ont elles non plus aucun besoin d'écriture aujourd'hui.
-- INSERT/UPDATE reviendront quand la vraie tâche planifiée du dette.md sera construite -- pas
-- avant, pour ne pas accorder un pouvoir qu'aucun code ne peut encore exercer.
-- ---------------------------------------------------------------------------------------------

grant select on public.demandes_export to service_role;
