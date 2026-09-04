import type { Href } from 'expo-router';

import type { SessionAuth } from '@/services/auth/port';
import type { EtatProfils } from '@/services/donnees/port';

// Seul endroit du dépôt qui décide où une session mène (docs/prompts/L1.md, P1.10 : "la
// redirection est décidée à un seul endroit"). Deux appelants, une seule fonction : app/index.tsx
// (démarrage à froid, racine "/") et app/(public)/_layout.tsx (règle 7 — une route de (public)
// atteinte avec une session valide renvoie vers l'espace actif). Aucun des deux ne code sa
// propre logique de redirection, tous deux appellent determinerDestination().
//
// PROVISOIRE, assumé — pas une approximation risquée : `comptes.profil_actif` est NOT NULL,
// défaut 'client' (0001_creer_identite.sql), posé à la création du compte, avant tout profil
// réel. On ne peut donc PAS distinguer aujourd'hui "onboarding jamais commencé" (règle 3) de
// "onboarding client commencé mais pas terminé" (règle 4) : rien ne fixe encore la valeur
// terminale d'`onboarding_etape` (P1.11, pas construit), et rien ne crée de profils_client
// avant que P1.11 existe. Les deux cas sont donc FUSIONNÉS ici en une seule condition — "pas de
// profil actif réel, quelle qu'en soit la raison" — vers la même destination provisoire.
// P1.11 les séparera une fois la valeur terminale d'onboarding_etape fixée et les routes
// (onboarding)/*.tsx construites — voir docs/dette.md.
//
// `(client)/accueil` reste la destination provisoire (écran de L0), pas une invention : aucune
// route `(onboarding)/*.tsx` n'existe encore pour y renvoyer réellement.
export function determinerDestination(
  session: SessionAuth | null,
  profils: EtatProfils | null,
): Href {
  if (!session) return '/(public)' as Href;
  if (!session.emailVerifie) return '/(public)/verification' as Href;

  if (profils?.profilActif === 'client' && profils.clientExiste) {
    return '/(client)/accueil' as Href;
  }
  if (profils?.profilActif === 'coach' && profils.coachExiste) {
    return '/(coach)/pilotage' as Href;
  }

  // Règles 3+4 fusionnées (voir le commentaire ci-dessus), et repli de sécurité si `profils`
  // est encore null (jamais interrogé, ou lecture en échec — src/fonctionnalites/identite/
  // fournisseur-donnees.tsx) : jamais grant d'accès à un espace sans preuve positive d'un
  // profil réel.
  //
  // À SÉPARER PAR P1.11 (onboarding client, docs/prompts/L1.md), pas avant : dès que
  // profils_client.onboarding_etape a une valeur terminale fixée, ce `return` unique devient
  // deux branches distinctes —
  //   - profils?.clientExiste === false                → règle 3, aucun profil du tout
  //     → `/(onboarding)/1-identite` (route qui n'existe qu'à partir de P1.11)
  //   - profils.clientExiste === true, onboarding non terminé → règle 4
  //     → l'étape non terminée (ex. `/(onboarding)/2-objectifs`), lue depuis
  //     `profils.onboardingEtape` — un champ que `EtatProfils` (src/services/donnees/port.ts)
  //     n'expose PAS encore, et que `portDonneesSupabase.lireEtatProfils()`
  //     (src/services/donnees/supabase.ts) ne lit pas non plus aujourd'hui (seulement
  //     `select('id')`, jamais `onboarding_etape`) : les deux sont à étendre au même prompt.
  // Le repli null ci-dessus (profils jamais interrogé / lecture en échec) reste, lui, la même
  // destination indéfiniment : ce n'est pas une des deux règles à séparer.
  return '/(client)/accueil' as Href;
}
