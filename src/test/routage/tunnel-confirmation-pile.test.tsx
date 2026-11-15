import { useEffect, useRef } from 'react';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router, useRouter, Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { detailAbonnementDemonstration } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L4-04c-confirmation-abonnement.md, critère 5 : « Après 04c, aucun geste de retour ne
// ramène à 04b ni à 04a ». Propriété de pile (CLAUDE.md §8) : seul expo-router/testing-library
// rend la VRAIE pile. Le parcours appuie sur ce qu'une personne appuierait : « S'abonner » sur le
// profil, « Continuer » sur 04a, « Payer » sur 04b ; la page de paiement est le seul double (le
// navigateur du téléphone, expo-web-browser), et le constat vient du faux port.
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })),
}));

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

// Même technique que tunnel-choix-offre.test.tsx : l'accueil pousse le profil une seule fois.
function AccueilPousseVersProfil() {
  const routeur = useRouter();
  const pousse = useRef(false);
  useEffect(() => {
    if (pousse.current) return;
    pousse.current = true;
    routeur.push('/(client)/coach/coach-yannick');
  }, [routeur]);
  return null;
}

afterEach(() => {
  jest.useRealTimers();
});

it('après le paiement, 04c s’empile sur le profil ; un retour ramène au profil, jamais à 04b ni 04a', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  // Le tunnel suppose maintenant un profil client terminé (GO accueil visiteur, L1-01a).
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, clientOnboardingEtape: 5 }),
  );
  portDonnees.definirProfilsCoachPublicsPourTest({
    'coach-yannick': {
      id: 'coach-yannick',
      prenom: 'Yannick',
      nom: 'Berthaud',
      photoUrl: null,
      discipline: 'préparation physique',
      titreCourt: null,
      bio: null,
      verifiee: true,
      verifieeDepuisLe: null,
      parcoursTexte: null,
      langues: [],
    },
  });
  portDonnees.definirOffresPubliquesPourTest({
    'coach-yannick': [
      {
        id: 'offre-suivi',
        titre: 'Suivi complet',
        description: null,
        prixCentimes: 4900,
        benefices: [],
        engagementHumain: ['ajustement hebdomadaire', 'visio mensuelle'],
        estMiseEnAvant: true,
        publieeLe: '2026-01-01T00:00:00.000Z',
        retireeLe: null,
      },
    ],
  });
  portDonnees.definirReponseIntentionPourTest({
    issue: 'creee',
    intentionId: 'intention-pile',
    recapitulatif: {
      prixCentimes: 4900,
      totalCentimes: 4900,
      prochainPrelevementLe: '2026-12-18',
      jourPrelevement: 18,
    },
    urlPaiement: 'https://paiement.exemple/pile',
    moyensAcceptes: ['carte', 'sepa'],
  });
  portDonnees.definirReponseConstatPourTest({
    issue: 'constat',
    etat: 'abonne',
    statutAbonnement: 'actif',
    abonnementId: detailAbonnementDemonstration.id,
  });
  portDonnees.definirDetailAbonnementPourTest({
    [detailAbonnementDemonstration.id]: { ...detailAbonnementDemonstration },
  });

  const rendu = await renderRouter(
    {
      appDir: './app',
      overrides: {
        _layout: creerRacineFaux(portAuth, portDonnees),
        '(client)/(tabs)/accueil': AccueilPousseVersProfil,
      },
    },
    { initialUrl: '/(client)/(tabs)/accueil' },
  );
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/coach/coach-yannick'));
  await waitFor(() => expect(screen.queryByText('Yannick Berthaud')).toBeTruthy());

  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'S’abonner · 49 €/mois' }).props.accessibilityState,
    ).toMatchObject({ disabled: false }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'S’abonner · 49 €/mois' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/souscription/coach-yannick'));

  await waitFor(() => expect(screen.queryByText('Continuer · 49 €/mois')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Continuer · 49 €/mois' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/souscription/paiement'));

  await waitFor(() => expect(screen.queryByText('Payer 49,00 €')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Payer 49,00 €' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/souscription/confirmation'));
  await waitFor(() => expect(screen.queryByText('C’est parti avec Yannick')).toBeTruthy());

  // Le geste de retour (matériel Android, glissement iOS) : GO_BACK sur la vraie pile.
  await act(async () => {
    router.back();
    await jest.runAllTimersAsync();
  });
  await waitFor(() => expect(rendu.getPathname()).toBe('/coach/coach-yannick'));
  expect(rendu.getPathname()).not.toBe('/souscription/paiement');
});
