import { useEffect } from 'react';
import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { router, useRouter, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees, useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-06-bascule-espace.md, critère 5, sens inverse — symétrique de
// bascule-client-vers-coach.test.tsx (voir son en-tête pour le raisonnement complet), dans un
// fichier séparé pour la même raison que profondeur-pile-*.test.tsx (P1.11) : plusieurs
// renderRouter() dans un seul fichier se sont montrés instables l'un après l'autre.
//
// Le double rejoue basculerProfil (du fournisseur, qui relit EtatProfils en cas de succès)
// PUIS router.replace — voir bascule-client-vers-coach.test.tsx pour le détail.
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

// Rejoue exactement la séquence de FeuilleBascule.basculerVers('client') après acceptation
// serveur, depuis l'espace COACH cette fois : basculerProfil (du fournisseur) PUIS
// router.replace.
function PilotageBasculeVersClient() {
  const { basculerProfil } = useDonnees();
  const routeur = useRouter();
  useEffect(() => {
    basculerProfil('client').then(() => routeur.replace('/(client)/accueil'));
  }, [basculerProfil, routeur]);
  return null;
}

async function compteConnecteEtVerifie(portAuth: ReturnType<typeof creerFauxPortAuth>) {
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
}

afterEach(() => {
  jest.useRealTimers();
});

it('la bascule coach → client réinitialise la pile coach : elle disparaît de l’arbre, canGoBack() faux (critère 5)', async () => {
  const portAuth = creerFauxPortAuth();
  await compteConnecteEtVerifie(portAuth);
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest({
    profilActif: 'coach',
    clientExiste: true,
    clientOnboardingEtape: 5,
    coachExiste: true,
    identiteActive: { prenom: 'Camille', nom: 'Coach' },
    attentesCoach: 0,
  });

  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(coach)/pilotage': PilotageBasculeVersClient,
      },
    },
    { initialUrl: '/(coach)/pilotage' },
  );

  act(() => jest.runOnlyPendingTimers());
  await waitFor(() => expect(rendu.getPathname()).toBe('/accueil'));

  // Critère 5, sens inverse : la pile de l'espace COACH disparaît de l'arbre plutôt que d'y
  // rester masquée derrière — sinon le retour arrière matériel Android y ramènerait.
  expect(router.canGoBack()).toBe(false);
  const racine = rendu.getRouterState()?.routes[0]?.state;
  expect(racine?.routes.map((r: { name: string }) => r.name)).toEqual(['(client)']);
});
