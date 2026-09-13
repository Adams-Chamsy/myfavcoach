import { useEffect } from 'react';
import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { router, useRouter, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees, useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L1-08-activation-espace-coach.md, critère 2 : après validation, l'application est
// dans l'espace coach, et la pile de l'espace quitté est réinitialisée (pas seulement masquée).
// CLAUDE.md §8 : ne se prouve pas avec un écran isolé et expo-router mocké — seul renderRouter
// rend la VRAIE pile.
//
// fireEvent ne déclenche aucun rendu fiable sous les minuteurs factices de renderRouter (leçon
// des autres fichiers de src/test/routage/) : on remplace donc devenir-coach.tsx par un double
// minimal qui rejoue EXACTEMENT ce que fait surValider après succès — creerProfilCoach (du
// fournisseur, qui relit EtatProfils lui-même) PUIS router.replace('/(coach)/(tabs)/pilotage'). Le
// suivi du formulaire lui-même est couvert par app/(onboarding)/devenir-coach.test.tsx.
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

function DevenirCoachValideAuMontage() {
  const { creerProfilCoach } = useDonnees();
  const routeur = useRouter();
  useEffect(() => {
    creerProfilCoach({
      discipline: 'yoga',
      telephone: '0612345678',
      prenom: 'Camille',
      nom: 'Dupré',
    }).then(() => routeur.replace('/(coach)/(tabs)/pilotage'));
  }, [creerProfilCoach, routeur]);
  return null;
}

async function compteConnecteEtVerifie(portAuth: ReturnType<typeof creerFauxPortAuth>) {
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');
}

// renderRouter() force des minuteurs Jest factices sans les retirer lui-même — sans ce retrait
// ils fuient vers les fichiers suivants du même worker (leçon de P1.11).
afterEach(() => {
  jest.useRealTimers();
});

it('après validation, l’application est dans l’espace coach et la pile est réinitialisée (critère 2)', async () => {
  const portAuth = creerFauxPortAuth();
  await compteConnecteEtVerifie(portAuth);
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest({
    profilActif: 'client',
    clientExiste: true,
    clientOnboardingEtape: 5,
    coachExiste: false,
    identiteActive: { prenom: 'Camille', nom: 'Dupré' },
    attentesCoach: 0,
  });

  const rendu = renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(onboarding)/devenir-coach': DevenirCoachValideAuMontage,
      },
    },
    { initialUrl: '/(onboarding)/devenir-coach' },
  );

  act(() => jest.runOnlyPendingTimers());
  await waitFor(() => expect(rendu.getPathname()).toBe('/pilotage'));

  // L'espace quitté n'est pas conservé derrière : router.replace a remplacé l'entrée racine, pas
  // empilé — le retour arrière matériel ne peut pas y ramener.
  expect(router.canGoBack()).toBe(false);
  const racine = rendu.getRouterState()?.routes[0]?.state;
  expect(racine?.routes.map((r: { name: string }) => r.name)).toEqual(['(coach)']);

  // « Un rechargement complet y revient » : le profil actif est bien côté serveur (ici le faux),
  // pas seulement en mémoire de navigation. La redirection au démarrage à froid depuis cet état
  // est prouvée par src/test/routage/redirections.test.ts (garde.ts, règle 6).
  const etat = await portDonnees.lireEtatProfils();
  expect(etat.profilActif).toBe('coach');
  expect(etat.coachExiste).toBe(true);
});
