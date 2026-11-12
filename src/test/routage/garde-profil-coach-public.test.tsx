import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { GardeAdressesPrivees } from '@/fonctionnalites/identite/garde-adresses-privees';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// Régression trouvée le 12 novembre 2026, le jour même de la garde (da7e62d) : le profil PUBLIC
// d'un coach vit dans le groupe (client), mais il est ouvert sans session par le parcours
// d'invitation (app/(public)/y/[jeton].tsx → « Voir le profil ») — « déjà fonctionnel sans
// session » (docs/ecrans/L2-12-profil-coach-public.md ; L3bis-I02, critère 1). La garde
// l'envoyait vers l'espace public. Fichier séparé : un seul renderRouter par fichier (CLAUDE.md §8).
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

it('sans session, le profil public d’un coach reste ouvert (arrivée par invitation)', async () => {
  const rendu = await renderRouter(
    { appDir: './app', overrides: { _layout: RacineSansSession } },
    { initialUrl: '/coach/coach-yannick' },
  );

  await waitFor(() => expect(rendu.getSegments()).toContain('coach'));
  // Laisse à la garde le temps d'agir, si elle le devait (minuteurs factices de renderRouter).
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(rendu.getPathname()).toBe('/coach/coach-yannick');
});
