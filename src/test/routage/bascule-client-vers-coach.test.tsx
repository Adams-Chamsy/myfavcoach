import { useEffect } from 'react';
import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { router, useRouter, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees, useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-06-bascule-espace.md, critère 5 (l'arbre de l'espace quitté est réinitialisé) —
// CLAUDE.md §8 : ne se prouve PAS avec un écran isolé et expo-router mocké, seul
// expo-router/testing-library (renderRouter) rend la VRAIE pile. Le critère 1 (la bascule mène
// au bon espace) est prouvé séparément, en test d'écran ordinaire, dans feuille-bascule.test.tsx
// (mêmes hrefs demandés à router.replace, mockés) : ce fichier-ci n'a donc pas besoin de rejouer
// la vraie pression sur l'avatar puis sur la ligne — remplace l'écran (client)/accueil par un
// écran minimal qui fait EXACTEMENT ce que FeuilleBascule.basculerVers('coach') fait une fois la
// bascule acceptée (port.basculerProfil PUIS router.replace), même principe que
// EtapeUnPousseVersEtapeDeux (profondeur-pile-push-onboarding.test.tsx, P1.11) : isole la
// question de la pile de la fiabilité d'une pression simulée sur un vrai Pressable — vérifié en
// écrivant ce fichier que fireEvent.press ne déclenche ICI aucun nouveau rendu, y compris pour
// un compteur minimal sans rapport avec ce lot (limite de cet environnement de test, pas un
// défaut de FeuilleBascule, déjà exercée avec succès en rendu simple par feuille-bascule.test.tsx).
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

// Rejoue exactement la séquence de FeuilleBascule.basculerVers('coach') après acceptation
// serveur : port.basculerProfil PUIS rafraichir() PUIS router.replace, jamais dans un autre
// ordre (docs/ecrans/L1-06-bascule-espace.md, Règles : "la valeur locale ne sert qu'à choisir
// la branche de navigation", jamais écrite avant confirmation). rafraichir() n'affecte pas la
// pile testée ici, mais l'omettre ferait diverger cette doublure du vrai code — c'est cette
// divergence qui avait rendu le défaut de fraîcheur de `profils.profilActif` invisible.
function AccueilBasculeVersCoach() {
  const { port, rafraichir } = useDonnees();
  const routeur = useRouter();
  useEffect(() => {
    port
      .basculerProfil('coach')
      .then(() => rafraichir())
      .then(() => routeur.replace('/(coach)/pilotage'));
  }, [port, rafraichir, routeur]);
  return null;
}

async function compteConnecteEtVerifie(portAuth: ReturnType<typeof creerFauxPortAuth>) {
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
}

// renderRouter() force des minuteurs Jest factices sans jamais les retirer lui-même — sans ce
// retrait explicite, ils fuient vers d'autres fichiers de test exécutés dans le même worker
// Jest (leçon de P1.11).
afterEach(() => {
  jest.useRealTimers();
});

it('la bascule client → coach réinitialise la pile client : elle disparaît de l’arbre, canGoBack() faux (critère 5)', async () => {
  const portAuth = creerFauxPortAuth();
  await compteConnecteEtVerifie(portAuth);
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest({
    profilActif: 'client',
    clientExiste: true,
    clientOnboardingEtape: 5,
    coachExiste: true,
    identiteActive: { prenom: 'Camille', nom: 'Dupré' },
    attentesCoach: 0,
  });

  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(client)/accueil': AccueilBasculeVersCoach,
      },
    },
    { initialUrl: '/(client)/accueil' },
  );

  // Flush le useEffect ci-dessus, bloqué sous les minuteurs factices de renderRouter — même
  // contournement que profondeur-pile-push-onboarding.test.tsx (P1.11).
  act(() => jest.runOnlyPendingTimers());
  await waitFor(() => expect(rendu.getPathname()).toBe('/pilotage'));

  // Critère 5 : la pile de l'espace CLIENT est réinitialisée, pas conservée derrière — sinon
  // le retour arrière matériel Android y ramènerait (docs/ecrans/L1-06-bascule-espace.md,
  // Règles). router.replace sur un chemin absolu depuis un écran imbriqué dans les Tabs de
  // (client) remplace l'entrée racine "(client)" par "(coach)" : elle disparaît donc
  // entièrement de l'arbre, pas seulement masquée.
  expect(router.canGoBack()).toBe(false);
  const racine = rendu.getRouterState()?.routes[0]?.state;
  expect(racine?.routes.map((r: { name: string }) => r.name)).toEqual(['(coach)']);
});
