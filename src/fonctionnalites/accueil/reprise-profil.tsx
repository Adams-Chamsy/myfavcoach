import { useEffect, useRef, type ReactElement } from 'react';
import { useRouter, useSegments, useGlobalSearchParams, type Href } from 'expo-router';

import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useParcoursVisiteur } from './fournisseur-parcours-visiteur';

// POP_TO conserve la recherche et le profil déjà visités derrière la connexion. Un replace
// produirait deux profils successifs et obligerait à revenir deux fois pour retrouver la liste.
export function RepriseProfil({ coachId }: { coachId: string }): ReactElement | null {
  const router = useRouter();
  useEffect(() => {
    router.dismissTo(`/(public)/profil/${coachId}` as Href);
  }, [router, coachId]);
  return null;
}

export function ConsommationRetourCoach(): null {
  const segments: readonly string[] = useSegments();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const { retourCoach, oublierRetour } = useParcoursVisiteur();
  const ancienCompte = useRef<string | null>(null);
  const ancienneRoute = useRef<string | null>(null);
  useEffect(() => {
    const compte = session?.emailVerifie ? session.compteId : null;
    const deconnexion = ancienCompte.current !== null && compte !== ancienCompte.current;
    ancienCompte.current = compte;
    const profilAtteint =
      ((segments[0] === '(client)' && segments[1] === 'coach') ||
        (segments[0] === '(public)' && segments[1] === 'profil')) &&
      id === retourCoach?.coachId;
    const annulation =
      !compte &&
      profilAtteint &&
      ['connexion', 'inscription'].includes(ancienneRoute.current ?? '');
    ancienneRoute.current = segments[1] ?? null;
    // Lire les segments GLOBAUX, pas un effet du profil : ce dernier peut rester monté
    // derrière la connexion et consommer l'intention avant que la navigation ait eu lieu.
    if (
      retourCoach &&
      (deconnexion || annulation || (compte && (profilAtteint || segments[0] === '(coach)')))
    )
      oublierRetour();
  }, [segments, id, session, retourCoach, oublierRetour]);
  return null;
}
