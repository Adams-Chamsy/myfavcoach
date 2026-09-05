import { renderRouter, waitFor, act } from 'expo-router/testing-library';
import { router, useRouter, Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// Contre-épreuve de profondeur-pile-entree-onboarding.test.tsx (fichier séparé, voir son
// en-tête pour pourquoi) : depuis un écran DÉJÀ monté (comme 1-identite.tsx après une écriture
// réussie), router.push AJOUTE une entrée — canGoBack() devient vrai. La pile n'est donc PAS
// vide par nature à partir de l'étape 2 : elle l'est seulement AVANT la première étape, à
// cause du replace initial. Le chevron de retour n'est décoratif qu'à l'étape 1, jamais après
// (voir garde.ts et src/fonctionnalites/identite/entete-onboarding.tsx).
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
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
}

// renderRouter() force des minuteurs Jest factices sans jamais les nettoyer lui-même — sans ce
// retrait explicite, ils fuient vers d'autres fichiers de test exécutés dans le même worker
// Jest ("A worker process has failed to exit gracefully").
afterEach(() => {
  jest.useRealTimers();
});

it('router.push(...) depuis un écran monté (comme surContinuer) AJOUTE une entrée : canGoBack() devient true', async () => {
  const portAuth = creerFauxPortAuth();
  await compteConnecteEtVerifie(portAuth);
  const portDonnees = creerFauxPortDonnees();

  // Remplace l'étape 1 par un écran minimal qui fait EXACTEMENT ce que fait
  // app/(onboarding)/1-identite.tsx après une écriture réussie (surContinuer) — pousse vers
  // l'étape 2 au montage, via useEffect (un vrai cycle de rendu React, pas du code de test
  // brut). Isole la question de profondeur de pile de la fiabilité d'une saisie/appui
  // simulés, non nécessaire ici.
  function EtapeUnPousseVersEtapeDeux() {
    const routeur = useRouter();
    useEffect(() => {
      routeur.push('/(onboarding)/2-objectifs');
    }, [routeur]);
    return null;
  }

  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(onboarding)/1-identite': EtapeUnPousseVersEtapeDeux,
      },
    },
    { initialUrl: '/' },
  );

  // renderRouter() force des minuteurs Jest factices en interne (contournement documenté dans
  // sa propre source, lié à des mises à jour d'état asynchrones de React Navigation) : le
  // useEffect ci-dessus ne se déclenche pas tout seul sous ces minuteurs factices sans ce
  // flush explicite — trouvé en écrivant ce test, pas une astuce arbitraire.
  act(() => {
    jest.runOnlyPendingTimers();
  });
  await waitFor(() => expect(rendu.getPathname()).toBe('/2-objectifs'));

  expect(router.canGoBack()).toBe(true);
  const racine = rendu.getRouterState()?.routes[0]?.state;
  expect(racine?.routes.map((r: { name: string }) => r.name)).toEqual([
    '(onboarding)/1-identite',
    '(onboarding)/2-objectifs',
  ]);
});
