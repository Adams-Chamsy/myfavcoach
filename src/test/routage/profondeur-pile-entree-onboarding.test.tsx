import { renderRouter, waitFor } from 'expo-router/testing-library';
import { router, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// Défaut signalé après P1.11 : « The action 'GO_BACK' was not handled by any navigator » au
// montage de l'étape 2. src/test/routage/redirections.test.ts ne prouve QUE la destination
// d'arrivée, jamais ce qu'il y a derrière — insuffisant pour ce défaut. Seul
// expo-router/testing-library (renderRouter) rend le VRAI arbre de navigation (Stack complet,
// vraie profondeur de pile) plutôt qu'un écran isolé avec expo-router entièrement mocké, comme
// le fait chaque test d'écran habituel. appDir: './app' charge les VRAIS fichiers de app/
// (index.tsx et garde.ts inclus) ; seul `_layout` racine est remplacé, pour injecter des faux
// ports au lieu des vrais services Supabase.
//
// Fichier séparé de profondeur-pile-push-onboarding.test.tsx, délibérément : renderRouter()
// force des minuteurs Jest factices sans jamais les nettoyer lui-même, et deux appels
// renderRouter() dans le même fichier — même avec `afterEach(() => jest.useRealTimers())` —
// se sont montrés instables l'un après l'autre en écrivant ce test (chaque test seul dans son
// fichier passe de façon fiable, ensemble dans un seul fichier non). Compromis délibéré, pas
// un oubli : deux fichiers minces plutôt qu'une suite fragile.
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
// Jest ("A worker process has failed to exit gracefully", trouvé en écrivant ce fichier).
afterEach(() => {
  jest.useRealTimers();
});

// Confirme l'hypothèse : app/index.tsx rend <Redirect> (router.replace), pas router.push. Un
// compte tout juste connecté n'a encore rien dans sa pile — REMPLACER l'unique entrée ('/')
// par '(onboarding)/1-identite' n'en laisse toujours qu'UNE, rien derrière.
it("l'entrée dans l'onboarding depuis la racine (Redirect/replace) laisse une pile SANS rien derrière : canGoBack() est false dès l'étape 1", async () => {
  const portAuth = creerFauxPortAuth();
  await compteConnecteEtVerifie(portAuth);
  const portDonnees = creerFauxPortDonnees(); // clientExiste: false par défaut → étape 1

  const rendu = renderRouter(
    { appDir: './app', overrides: { _layout: creerRacineFaux(portAuth, portDonnees) } },
    { initialUrl: '/' },
  );

  await waitFor(() => expect(rendu.getPathname()).toBe('/1-identite'));

  expect(router.canGoBack()).toBe(false);
  const racine = rendu.getRouterState()?.routes[0]?.state;
  expect(racine?.routes.map((r: { name: string }) => r.name)).toEqual(['(onboarding)/1-identite']);
});
