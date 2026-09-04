import type { Href } from 'expo-router';

import type { SessionAuth } from '@/services/auth/port';
import type { EtatProfils } from '@/services/donnees/port';

// Seul endroit du dépôt qui décide où une session mène (docs/prompts/L1.md, P1.10 : "la
// redirection est décidée à un seul endroit"). Deux appelants, une seule fonction : app/index.tsx
// (démarrage à froid, racine "/") et app/(public)/_layout.tsx (règle 7 — une route de (public)
// atteinte avec une session valide renvoie vers l'espace actif). Aucun des deux ne code sa
// propre logique de redirection, tous deux appellent determinerDestination().
//
// Valeur terminale d'onboarding_etape (P1.11, docs/ecrans/L1-05-onboarding-client.md) : la
// ligne profils_client n'existe qu'à partir de l'étape 1 validée (creerProfilClient l'insère
// avec onboarding_etape=2, jamais 1 — le DEFAULT 1 de 0001_creer_identite.sql n'est donc
// jamais atteint par un vrai parcours). Chaque étape validée fait passer onboarding_etape à
// N+1 : 2 = "affiche l'étape 2", 3 = "affiche l'étape 3", 4 = "affiche l'étape 4",
// 5 = onboarding terminé (terminerOnboarding). "> 4", pas "=== 5" : defensif, au cas où une
// valeur future dépasserait 5 sans que ce soit une régression.
const ROUTE_PAR_ETAPE: Record<number, Href> = {
  1: '/(onboarding)/1-identite' as Href,
  2: '/(onboarding)/2-objectifs' as Href,
  3: '/(onboarding)/3-poids' as Href,
  4: '/(onboarding)/4-cest-parti' as Href,
};

export function determinerDestination(
  session: SessionAuth | null,
  profils: EtatProfils | null,
): Href {
  if (!session) return '/(public)' as Href;
  if (!session.emailVerifie) return '/(public)/verification' as Href;

  if (profils?.profilActif === 'client') {
    if (!profils.clientExiste) return ROUTE_PAR_ETAPE[1]; // règle 3 : aucun profil du tout
    const etape = profils.clientOnboardingEtape ?? 1;
    if (etape > 4) return '/(client)/accueil' as Href; // onboarding terminé → règle 5
    return ROUTE_PAR_ETAPE[etape] ?? ROUTE_PAR_ETAPE[1]; // règle 4 : étape non terminée
  }

  if (profils?.profilActif === 'coach' && profils.coachExiste) {
    return '/(coach)/pilotage' as Href; // règle 6
  }

  // Repli, deux cas distincts qui restent fusionnés (aucun des deux n'est une des sept
  // règles à séparer) :
  // - profils est encore null : jamais interrogé, ou lecture en échec
  //   (src/fonctionnalites/identite/fournisseur-donnees.tsx) — jamais grant d'accès à un
  //   espace sans preuve positive d'un profil réel.
  // - profilActif==='coach' && !coachExiste : espace actif coach sans profil coach réel.
  //   L1-08 (activation espace coach) n'est pas construit — aucune route n'existe encore pour
  //   ce cas, et il n'entre dans aucune des sept règles de P1.10 (qui ne couvrent que le côté
  //   client de cette situation). `(client)/accueil` reste ici la même destination
  //   provisoire qu'avant P1.11, pas une invention.
  return '/(client)/accueil' as Href;
}
