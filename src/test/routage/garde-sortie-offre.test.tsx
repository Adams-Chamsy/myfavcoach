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

// A3, décision du développeur du 12 novembre 2026 : « fermer une offre modifiée sans enregistrer :
// oui, confirmation, avec la garde de sortie qui existe déjà ». La garde (useGardeSortie) exige un
// Stack de expo-router/js-stack ; le groupe app/(coach)/creer/ avait le Stack natif. Même double
// minimal que garde-sortie-informations.test.tsx (fireEvent ne déclenche aucun rendu fiable sous
// les minuteurs factices de renderRouter) : c'est l'interaction de la garde avec la VRAIE pile du
// groupe qui est prouvée ici ; le suivi des modifications du vrai formulaire est prouvé par
// src/fonctionnalites/offres/ecran-creation-offre.test.tsx.
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

function DoubleOffreAvecGarde() {
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

function IndexQuiPousseVersOffre() {
  const routeur = useRouter();
  useEffect(() => {
    routeur.push('/(coach)/creer/offre');
  }, [routeur]);
  return null;
}

// renderRouter() force des minuteurs Jest factices sans les retirer lui-même — sans ce retrait
// ils fuient vers les fichiers suivants du même worker (leçon de P1.11).
afterEach(() => {
  jest.useRealTimers();
  poignee.sortie = null;
});

it('un retour depuis l’écran d’offre avec modifications est intercepté, puis la reprise aboutit', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();

  const rendu = await renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        index: IndexQuiPousseVersOffre,
        '(coach)/creer/[type]': DoubleOffreAvecGarde,
      },
    },
    { initialUrl: '/' },
  );

  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  await waitFor(() => expect(rendu.getPathname()).toBe('/creer/offre'));

  // Le router.back() du montage a été tenté : la garde doit l'avoir bloqué.
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(rendu.getPathname()).toBe('/creer/offre');
  expect(poignee.sortie).not.toBeNull();

  // Reprise confirmée (« Quitter ») : la même action de navigation est rejouée, cette fois
  // laissée passer.
  await act(async () => {
    poignee.sortie?.reprendre();
  });
  await waitFor(() => expect(rendu.getPathname()).not.toBe('/creer/offre'));
});
