-- Corrige un trou trouvé par la CI (banc-rls.yml), sur le commit qui a introduit L3bis, jamais
-- vu contre le projet de développement distant : `revoke execute on function ... from public`
-- (0026/0027/0029) ne retire PAS un grant SÉPARÉ posé directement à `anon`/`authenticated`/
-- `service_role` -- exactement le trou que 0006_verrouiller_grants.sql a déjà fermé pour
-- profil_actif_courant() et consorts, reproduit ici parce que L3bis a suivi la forme
-- "revoke ... from public" plutôt que la convention explicite de 0006 ("revoke ... from public,
-- anon, authenticated" -- jamais "from public" seul quand un rôle nommé doit être fermé).
--
-- La pile Supabase LOCALE (supabase start, CI) accorde `GRANT ALL` à anon/authenticated à son
-- démarrage (0006, commentaire de tête). `service_role`, lui, part sur cette même pile d'un
-- baseline plus large que sur le projet distant : constaté ici en CI, une pile fraîche a laissé
-- service_role modifier une ligne d'`invitations` (statut -> 'abonnee') malgré l'absence de tout
-- grant UPDATE explicite (0027 n'accorde que select + insert). Sur le projet distant, où les deux
-- baselines sont déjà vides, ce trou n'a jamais mordu -- il reste réel pour toute FUTURE base
-- rejouée de zéro (une nouvelle pile locale, un futur environnement de test), donc corrigé ici
-- plutôt que laissé en dette.
--
-- Convention (rappelée de 0006) : revoke EXPLICITEMENT tous les rôles concernés avant de
-- regrant, jamais "from public" seul quand un rôle nommé doit être fermé.

revoke all on public.invitations from anon, authenticated, service_role;
grant select, insert on public.invitations to service_role;

revoke execute on function public.mon_jeton_invitation()
  from public, anon, authenticated, service_role;
grant execute on function public.mon_jeton_invitation() to authenticated;

revoke execute on function public.regenerer_jeton_invitation()
  from public, anon, authenticated, service_role;
grant execute on function public.regenerer_jeton_invitation() to authenticated;

revoke execute on function public.mes_invitations()
  from public, anon, authenticated, service_role;
grant execute on function public.mes_invitations() to authenticated;

revoke execute on function public.nombre_invitations_en_attente()
  from public, anon, authenticated, service_role;
grant execute on function public.nombre_invitations_en_attente() to authenticated;

revoke execute on function public.ajouter_invitation_en_attente()
  from public, anon, authenticated, service_role;
grant execute on function public.ajouter_invitation_en_attente() to authenticated;
