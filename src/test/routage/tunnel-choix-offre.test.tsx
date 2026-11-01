import { useEffect, useRef } from 'react';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L4-04a-choix-offre.md (P4.6a) : 04a s'EMPILE sur le profil du coach, et son bouton
// « Retour » y ramène. Propriété de pile (CLAUDE.md §8) : jamais prouvée par un test d'écran
// isolé, où expo-router est mocké — seulement ici, sur la vraie pile. Le risque exact : une
// route atteinte par un remplacement plutôt qu'un empilement fait planter « Retour »
// (« GO_BACK non géré »), ou le ramène ailleurs que sur le profil.
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function creerRacineFaux(
  portAuth: ReturnType<typeof creerFauxPortAuth>,
  portDonnees: ReturnType<typeof creerFauxPortDonnees>,
) {
  return function RacineFaux() {
    return (
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <FournisseurSession port={portAuth}>
            <FournisseurDonnees port={portDonnees}>
              <Stack screenOptions={{ headerShown: false }} />
            </FournisseurDonnees>
          </FournisseurSession>
        </FournisseurTheme>
      </SafeAreaProvider>
    );
  };
}

// Entre par l'accueil, comme toute session réelle, puis rejoint le profil par un vrai push
// (même technique que cache-recherche-retour-profil.test.tsx). UNE SEULE FOIS : l'accueil reste
// monté sous la pile, et son effet se relance quand le routeur change d'identité — sans cette
// garde, il repoussait le profil après chaque navigation, et le routeur paraissait figé (trouvé
// en écrivant ce test).
function AccueilPousseVersProfil() {
  const routeur = useRouter();
  const pousse = useRef(false);
  useEffect(() => {
    if (pousse.current) return;
    pousse.current = true;
    routeur.push('/(client)/coach/coach-yannick');
  }, [routeur]);
  return null;
}

afterEach(() => {
  jest.useRealTimers();
});

it('04a s’empile sur le profil du coach, et « Retour » y ramène', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  // src/fixtures/demonstration.ts : Yannick Berthaud, « Suivi complet », 49 €/mois.
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirProfilsCoachPublicsPourTest({
    'coach-yannick': {
      id: 'coach-yannick',
      prenom: 'Yannick',
      nom: 'Berthaud',
      photoUrl: null,
      discipline: 'préparation physique',
      titreCourt: null,
      bio: null,
      verifiee: true,
      verifieeDepuisLe: null,
      parcoursTexte: null,
      langues: [],
    },
  });
  portDonnees.definirOffresPubliquesPourTest({
    'coach-yannick': [
      {
        id: 'offre-suivi',
        titre: 'Suivi complet',
        description: null,
        prixCentimes: 4900,
        benefices: [],
        engagementHumain: ['ajustement hebdomadaire', 'visio mensuelle'],
        estMiseEnAvant: true,
        publieeLe: '2026-01-01T00:00:00.000Z',
        retireeLe: null,
      },
    ],
  });

  const rendu = await renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(client)/(tabs)/accueil': AccueilPousseVersProfil,
      },
    },
    { initialUrl: '/(client)/(tabs)/accueil' },
  );
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/coach/coach-yannick'));
  // Le profil a fini ses lectures avant qu'on pousse : sinon leur mise à jour d'état tombe au
  // milieu de la navigation (« overlapping act() calls », trouvé en écrivant ce test).
  await waitFor(() => expect(screen.queryByText('Yannick Berthaud')).toBeTruthy());

  // Le vrai bouton « S'abonner » du profil, pas un push du test : c'est SON chemin qui doit
  // empiler 04a.
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'S’abonner · 49 €/mois' }).props.accessibilityState,
    ).toMatchObject({ disabled: false }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'S’abonner · 49 €/mois' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/souscription/coach-yannick'));
  // L'en-tête de 04a, rendu sans attendre de lecture : la propriété exercée ici est la pile, pas
  // le contenu de l'écran (prouvé par son propre test, ecran-choix-offre.test.tsx).
  await waitFor(() => expect(screen.queryByText('Étape 1 sur 2')).toBeTruthy());

  // Le bouton « Retour » de 04a lui-même, pas un router.back() du test : c'est SON chemin qui
  // doit trouver le profil derrière lui.
  await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/coach/coach-yannick'));
});
