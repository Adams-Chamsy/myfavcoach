import { useEffect } from 'react';
import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useGardeSortie, type SortieEnAttente } from '@/fonctionnalites/navigation/garde-sortie';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/prompts/L1.md P1.13b, critère 8 : une sortie « retour » avec des modifications non
// enregistrées est interceptée, pas exécutée. CLAUDE.md §8 : ne se prouve PAS avec un écran
// isolé et expo-router mocké — seul renderRouter rend la VRAIE pile, avec le vrai
// `beforeRemove` du Stack de `expo-router/js-stack` posé par app/(compte)/_layout.tsx.
//
// fireEvent.press / changeText ne déclenchent aucun rendu fiable sous les minuteurs factices
// de renderRouter (leçon des autres fichiers de src/test/routage/) : on remplace donc l'écran
// « Mes informations » par un double minimal qui appelle useGardeSortie(true) et tente un
// router.back() au montage. C'est l'INTERACTION du hook avec la vraie pile qui est testée ici
// (la garde intercepte-t-elle ? la reprise aboutit-elle ?) — le suivi « modifié » du vrai
// formulaire est couvert par app/(compte)/informations.test.tsx.
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

// Poignée exposée au test : la dernière valeur de sortieEnAttente rendue par le double.
// Objet const muté dans un effet, jamais réassigné pendant le rendu (react-hooks/globals).
const poignee: { sortie: SortieEnAttente } = { sortie: null };

function DoubleInformationsAvecGarde() {
  const routeur = useRouter();
  const { sortieEnAttente } = useGardeSortie(true);

  useEffect(() => {
    poignee.sortie = sortieEnAttente;
  }, [sortieEnAttente]);

  // Tente de quitter par « retour » dès le montage — après que useGardeSortie a posé son
  // listener (son effet est déclaré en premier, donc exécuté en premier).
  useEffect(() => {
    routeur.back();
  }, [routeur]);

  return null;
}

function IndexQuiPousseVersInformations() {
  const routeur = useRouter();
  useEffect(() => {
    routeur.push('/(compte)/informations');
  }, [routeur]);
  return null;
}

// renderRouter() force des minuteurs Jest factices sans les retirer lui-même — sans ce retrait
// ils fuient vers les fichiers suivants du même worker (leçon de P1.11).
afterEach(() => {
  jest.useRealTimers();
  poignee.sortie = null;
});

it('un retour depuis « Mes informations » avec modifications est intercepté, puis la reprise aboutit (critère 8)', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();

  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        index: IndexQuiPousseVersInformations,
        '(compte)/informations': DoubleInformationsAvecGarde,
      },
    },
    { initialUrl: '/' },
  );

  act(() => jest.runOnlyPendingTimers());
  await waitFor(() => expect(rendu.getPathname()).toBe('/informations'));

  // Le router.back() du montage a été tenté : la garde doit l'avoir bloqué.
  act(() => jest.runOnlyPendingTimers());
  expect(rendu.getPathname()).toBe('/informations');
  expect(poignee.sortie).not.toBeNull();

  // Reprise confirmée (« Quitter ») : la même action de navigation est rejouée, cette fois
  // laissée passer.
  act(() => poignee.sortie?.reprendre());
  await waitFor(() => expect(rendu.getPathname()).not.toBe('/informations'));
});
