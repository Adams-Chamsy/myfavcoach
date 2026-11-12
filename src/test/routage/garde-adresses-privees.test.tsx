import { readFileSync } from 'fs';
import { join } from 'path';
import { renderRouter, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { GardeAdressesPrivees } from '@/fonctionnalites/identite/garde-adresses-privees';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// Décidé le 12 novembre 2026 : « aucune adresse privée ne renvoie vers la connexion sans session :
// corrige, c'est le rôle de la garde ». Mesuré la veille sur le web : /pilotage ouvert sans session
// affichait le cadre de l'espace coach vide, /moi « On a un souci de notre côté », /accueil
// « Salut » sans prénom. Même trou sur mobile pour tout lien profond `myfavcoach://` vers une
// page privée reçu sans session. Propriété de navigation : renderRouter (CLAUDE.md §8).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

function RacineSansSession() {
  return (
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={creerFauxPortAuth()}>
          <FournisseurDonnees port={creerFauxPortDonnees()}>
            <GardeAdressesPrivees />
            <Stack screenOptions={{ headerShown: false }} />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>
  );
}

afterEach(() => {
  jest.useRealTimers();
});

it('sans session, une adresse de l’espace coach mène à l’espace public', async () => {
  const rendu = await renderRouter(
    { appDir: './app', overrides: { _layout: RacineSansSession } },
    { initialUrl: '/pilotage' },
  );

  await waitFor(() => expect(rendu.getPathname()).toBe('/'));
  expect(rendu.getSegments()[0]).toBe('(public)');
});

// Le test ci-dessus monte la garde dans un faux layout racine : il ne prouve rien si le VRAI
// layout ne la monte pas.
it('le layout racine monte la garde sous les fournisseurs, à côté de la pile', () => {
  const racine = readFileSync(join(__dirname, '..', '..', '..', 'app', '_layout.tsx'), 'utf8');
  expect(racine).toMatch(/<FournisseurDonnees[^>]*>\s*<GardeAdressesPrivees \/>\s*<Stack/);
});
