// Consentement aux données de santé (docs/domaine.md §3.12). Le texte exact ET sa version
// datée doivent être identiques partout où le consentement est demandé — l'onboarding
// (app/(onboarding)/3-poids.tsx, étape 3/4) et l'écran Confidentialité (P1.13d,
// app/(compte)/confidentialite.tsx). Deux copies divergentes du numéro de version, c'est un
// consentement enregistré sous une version qui ne correspond à aucun texte réellement montré :
// une seule source ici.
//
// « Un consentement sans version est un consentement inutilisable » (docs/domaine.md §3.12,
// contrainte NOT NULL de consentements.version) — même mécanisme que VERSION_CGU_ACCEPTEE
// (src/services/auth/supabase.ts). Contrairement aux CGU (lot L11, texte pas encore rédigé),
// CE texte est le texte réel de ce lot : rien de provisoire.
export const VERSION_CONSENTEMENT_SANTE = '2026-09-04';

export const TEXTE_CONSENTEMENT_SANTE =
  "J'accepte que My fav Coach enregistre mes données de santé pour suivre ma progression.";
