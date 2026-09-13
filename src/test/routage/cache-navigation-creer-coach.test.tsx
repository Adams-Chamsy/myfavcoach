import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { router, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// Même défaut que src/test/routage/cache-recherche-retour-profil.test.tsx, côté coach cette
// fois : app/(coach)/_layout.tsx avait la même structure Tabs (expo-router/js-tabs) que
// app/(client)/_layout.tsx avant sa restructuration, et « creer » (feuille « Créer », atteignable
// depuis n'importe quel onglet) y était poussé de la même façon — vérifié ici (rouge avant la
// restructuration du 13 septembre 2026), pas supposé. Même correction : les quatre onglets
// vivent dans app/(coach)/(tabs)/_layout.tsx, creer/ reste en écran FRÈRE de ce groupe.
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

async function compteConnecteEtVerifie(portAuth: ReturnType<typeof creerFauxPortAuth>) {
  await portAuth.inscrire('nadia@exemple.fr', 'bon-mot-de-passe', '1990-01-01');
  portAuth.verifierEmailPourTest('nadia@exemple.fr');
  await portAuth.connecter('nadia@exemple.fr', 'bon-mot-de-passe');
}

afterEach(() => {
  jest.useRealTimers();
});

it('retour depuis « Créer une offre », poussé depuis l’onglet Clients : retrouve Clients, jamais Pilotage', async () => {
  const portAuth = creerFauxPortAuth();
  await compteConnecteEtVerifie(portAuth);
  const portDonnees = creerFauxPortDonnees();

  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: { _layout: creerRacineFaux(portAuth, portDonnees) },
    },
    // Entre directement sur l'onglet Clients (pas Pilotage, le premier onglet) : c'est
    // précisément la divergence qui révèle le défaut — si le retour arrière ramenait
    // simplement au premier onglet quel que soit le point de départ, ça passerait inaperçu
    // depuis Pilotage.
    { initialUrl: '/(coach)/(tabs)/clients' },
  );

  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/clients'));

  act(() => router.push('/(coach)/creer/offre'));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/creer/offre'));

  act(() => router.back());
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/clients'));
});
