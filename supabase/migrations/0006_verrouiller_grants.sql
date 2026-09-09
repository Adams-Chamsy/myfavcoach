-- Verrouille les privilèges : revoke explicite AVANT chaque grant étroit.
--
-- 0001 et 0002 posent `grant update (colonne)` / `grant execute … to authenticated` en
-- supposant que anon/authenticated partent de zéro privilège — vrai sur un projet Supabase
-- HÉBERGÉ. Une pile Supabase LOCALE (`supabase start`, workflow .github/workflows/banc-rls.yml)
-- accorde d'abord `GRANT ALL … TO anon, authenticated` à son démarrage : les grants étroits
-- deviennent alors additifs et ne restreignent plus rien (UPDATE direct de comptes.profil_actif
-- accepté, anon peut appeler profil_actif_courant()…). Trouvé au premier run CI du banc (P1.15).
--
-- Cette migration rend 0001/0002 auto-portants : elle retire TOUT, puis ne redonne QUE ce que
-- 0001/0002 avaient l'intention de donner. Sur le projet distant, où le baseline est déjà vide,
-- les `revoke` sont des no-op suivis des mêmes grants qu'avant : aucun changement de
-- comportement, seulement l'indépendance à l'hôte.
--
-- Convention pour toute migration future : revoke puis grant, jamais grant seul.

-- ---------------------------------------------------------------------------------------------
-- Tables et vues : tout retirer à anon + authenticated, redonner les grants de 0001 à
-- l'identique (colonne par colonne pour UPDATE — jamais table entière, jamais anon).
-- ---------------------------------------------------------------------------------------------

revoke all on public.comptes from anon, authenticated;
grant select on public.comptes to authenticated;
grant update (telephone) on public.comptes to authenticated;

revoke all on public.profils_client from anon, authenticated;
grant select, insert on public.profils_client to authenticated;
grant update (
  prenom, nom, photo_url, commune_insee, objectifs, rythme_hebdo,
  poids_depart_grammes, poids_cible_grammes, onboarding_etape
) on public.profils_client to authenticated;

revoke all on public.profils_coach from anon, authenticated;
grant select, insert on public.profils_coach to authenticated;
grant update (
  prenom, nom, photo_url, discipline, titre_court, bio, commune_base_insee
) on public.profils_coach to authenticated;

revoke all on public.consentements from anon, authenticated;
grant select, insert on public.consentements to authenticated;

revoke all on public.consentements_courants from anon, authenticated;
grant select on public.consentements_courants to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Fonctions : execute retiré à tous, redonné au seul rôle qui doit l'avoir.
-- ---------------------------------------------------------------------------------------------

-- RPC appelables par l'application (docs/backend.md §7) : authenticated uniquement.
revoke all on function public.profil_actif_courant() from public, anon, authenticated;
grant execute on function public.profil_actif_courant() to authenticated;

revoke all on function public.basculer_profil(public.profil_actif_enum) from public, anon, authenticated;
grant execute on function public.basculer_profil(public.profil_actif_enum) to authenticated;

revoke all on function public.creer_profil_coach(text, text, text, text) from public, anon, authenticated;
grant execute on function public.creer_profil_coach(text, text, text, text) to authenticated;

-- Fonctions de déclencheur : jamais appelées via l'API (Postgres exécute un trigger sans
-- vérifier EXECUTE sur sa fonction). Aucun grant — execute retiré à tous par principe.
revoke all on function public.verifier_age_majeur() from public, anon, authenticated;
revoke all on function public.creer_compte_depuis_auth() from public, anon, authenticated;
revoke all on function public.verifier_consentement_sante_poids() from public, anon, authenticated;
