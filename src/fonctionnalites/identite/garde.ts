import type { Href } from 'expo-router';

import type { SessionAuth } from '@/services/auth/port';

// Seul endroit du dépôt qui décide où une session mène (docs/prompts/L1.md, P1.10 : "la
// redirection est décidée à un seul endroit"). Créé en avance par P1.8 (écran de vérification,
// L1-03) parce que ce dernier a déjà besoin d'une décision de redirection après le lien
// profond — jamais codée dans l'écran lui-même, ce serait une deuxième source de décision.
//
// Aujourd'hui, seules les règles calculables à partir de SessionAuth (jetons, e-mail vérifié)
// sont connues : trois des sept règles de P1.10 (docs/prompts/L1.md). Les quatre autres
// (existence des profils, profil actif, retour depuis (public)) exigent le compte et les
// profils du serveur (docs/api.md §3, GET /moi) — un port qui n'existe pas encore
// (src/services/donnees/, lot ultérieur). P1.10 réécrira ce module en entier avec ces données ;
// jusque-là, cette fonction ne prétend décider que ce qu'elle peut vraiment observer.
export function determinerDestination(session: SessionAuth | null): Href {
  if (!session) return '/(public)' as Href;
  if (!session.emailVerifie) return '/(public)/verification' as Href;

  // Aucun profil connu : src/services/donnees/ (le port qui donnerait profils/profilActif)
  // n'existe pas encore, donc TOUT compte vérifié est traité comme "onboarding non terminé" —
  // c'est vrai aujourd'hui (rien ne crée encore de profil avant l'onboarding), pas une
  // approximation risquée pour l'instant. Destination PROVISOIRE : (client)/accueil est l'écran
  // provisoire du lot L0, pas une invention — en attendant la vraie étape d'onboarding.
  // À LEVER PAR P1.11 (onboarding client, docs/prompts/L1.md), pas P1.10 : P1.10 restructure
  // cette décision autour des vraies données de profil, mais les routes (onboarding)/*.tsx
  // elles-mêmes n'existent qu'à partir de P1.11 — voir docs/dette.md.
  return '/(client)/accueil' as Href;
}
