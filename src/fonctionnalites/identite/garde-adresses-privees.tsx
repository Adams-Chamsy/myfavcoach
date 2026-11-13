import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useDonnees } from './fournisseur-donnees';
import { useSession } from './fournisseur-session';
import { determinerDestination } from './garde';

// Les groupes de l'application qui exigent une session vérifiée. Les autres : (public) a sa
// propre garde (app/(public)/_layout.tsx), (admin) sa propre connexion, la galerie et le
// répartiteur (app/index.tsx) décident eux-mêmes.
const GROUPES_PRIVES = new Set(['(client)', '(coach)', '(compte)', '(onboarding)']);

// Les écrans privés par leur groupe, mais lisibles sans session : chacun nommé, avec sa raison.
// Lus par la garde ci-dessous ET par src/test/destinations-privees-depuis-public.test.ts, qui
// exige que toute adresse privée écrite dans un écran public (app/(public)/) en soit une : la
// régression du 12 novembre 2026 (le lien d'invitation renvoyé à la bienvenue par cette garde
// même) ne se reforme pas en silence.
export const EXCEPTIONS_ADRESSES_PRIVEES: readonly {
  segments: readonly string[];
  raison: string;
}[] = [
  {
    // app/(client)/coach/[id].tsx : docs/ecrans/L2-12-profil-coach-public.md. Le parcours
    // d'invitation l'ouvre sans session (app/(public)/y/[jeton].tsx).
    segments: ['(client)', 'coach'],
    raison: 'profil public d’un coach, ouvert sans session par le lien d’invitation',
  },
];

function estExceptionPublique(segments: readonly string[]): boolean {
  return EXCEPTIONS_ADRESSES_PRIVEES.some((e) => e.segments.every((s, i) => segments[i] === s));
}

// Décidé le 12 novembre 2026 : une adresse privée ouverte sans session mène là où la garde le
// dit (determinerDestination : l'espace public, ou la vérification de l'adresse), jamais à un
// écran privé rendu à vide. Mesuré la veille sur le web (/pilotage : le cadre de l'espace coach
// vide ; /moi : « On a un souci de notre côté » ; /accueil : « Salut » sans prénom), et le même
// trou existe sur mobile pour un lien profond `myfavcoach://…` vers une page privée reçu sans
// session. Montée dans le layout racine, sous les fournisseurs : un seul endroit pour tous les
// groupes, y compris (onboarding) qui n'a pas de layout à lui.
//
// Jamais pendant le chargement (session ou profils) : une redirection décidée sur des données pas
// encore arrivées renverrait un utilisateur connecté vers l'espace public (même principe que
// app/index.tsx). `router.replace` dans un effet, jamais pendant le rendu (CLAUDE.md §8).
export function GardeAdressesPrivees(): null {
  const segments = useSegments();
  const router = useRouter();
  const { chargement: chargementSession, session } = useSession();
  const { chargement: chargementDonnees, profils } = useDonnees();

  const groupePrive = GROUPES_PRIVES.has(segments[0] ?? '') && !estExceptionPublique(segments);
  const sansSessionVerifiee = !session?.emailVerifie;

  useEffect(() => {
    if (chargementSession || chargementDonnees) return;
    if (!groupePrive || !sansSessionVerifiee) return;
    router.replace(determinerDestination(session, profils));
  }, [
    chargementSession,
    chargementDonnees,
    groupePrive,
    sansSessionVerifiee,
    session,
    profils,
    router,
  ]);

  return null;
}
