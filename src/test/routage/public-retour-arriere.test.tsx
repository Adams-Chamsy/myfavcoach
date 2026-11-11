import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { router, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// Groupe public (bienvenue, connexion, inscription, mot de passe oublié…) : le retour arrière
// ramène à l'écran d'où l'on vient, quand on y est arrivé par une poussée. Hypothèse du 2 novembre
// 2026, en cherchant la cause de B2 (« mot de passe oublié, aucune sortie ») : le <Slot /> de
// app/(public)/_layout.tsx ne laisserait rien derrière l'écran. **Mesurée fausse le 11 novembre
// 2026 par ce test** : la poussée passe par la pile racine, et le retour fonctionne. Ce test est
// donc vert par construction — un garde-fou, pas la preuve d'une correction. Le vrai cul-de-sac
// est l'arrivée par un remplacement (« Ce lien a expiré » → « M'en renvoyer un ») : c'est ce que
// couvre « Retour à la connexion » (B2). Propriété de pile : renderRouter (CLAUDE.md §8).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function creerRacineFaux() {
  const portAuth = creerFauxPortAuth();
  const portDonnees = creerFauxPortDonnees();
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

// renderRouter() force des minuteurs Jest factices sans jamais les retirer lui-même (P1.11).
afterEach(() => {
  jest.useRealTimers();
});

it('connexion → « Mot de passe oublié » : le retour arrière ramène à la connexion', async () => {
  const rendu = await renderRouter(
    { appDir: './app', overrides: { _layout: creerRacineFaux() } },
    { initialUrl: '/connexion' },
  );
  await waitFor(() => expect(rendu.getPathname()).toBe('/connexion'));

  await act(async () => {
    router.push('/(public)/mot-de-passe-oublie');
    jest.runOnlyPendingTimers();
  });
  await waitFor(() => expect(rendu.getPathname()).toBe('/mot-de-passe-oublie'));

  expect(router.canGoBack()).toBe(true);
  await act(async () => {
    router.back();
    jest.runOnlyPendingTimers();
  });
  await waitFor(() => expect(rendu.getPathname()).toBe('/connexion'));
});
