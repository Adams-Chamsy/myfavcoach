import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useDonnees } from './fournisseur-donnees';
import { useSession } from './fournisseur-session';
import { determinerDestination } from './garde';

// Les groupes de l'application qui exigent une session vérifiée. Les autres : (public) a sa
// propre garde (app/(public)/_layout.tsx), (admin) sa propre connexion, la galerie et le
// répartiteur (app/index.tsx) décident eux-mêmes.
const GROUPES_PRIVES = new Set(['(client)', '(coach)', '(compte)', '(onboarding)']);

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

  // Exception nommée : le profil PUBLIC d'un coach (app/(client)/coach/[id].tsx) vit dans le
  // groupe (client), mais il est lisible sans session (docs/ecrans/L2-12-profil-coach-public.md)
  // et le parcours d'invitation l'ouvre ainsi (app/(public)/y/[jeton].tsx). Régression du jour
  // même de cette garde, trouvée le 12 novembre 2026.
  const profilCoachPublic = segments[0] === '(client)' && segments[1] === 'coach';
  const groupePrive = GROUPES_PRIVES.has(segments[0] ?? '') && !profilCoachPublic;
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
