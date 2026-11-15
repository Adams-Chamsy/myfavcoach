import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { detailAbonnementImpayeDemonstration } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L4-24b-mes-abonnements.md, critère 4 : « impaye et suspendu ouvrent l'écran 20 » ;
// docs/ecrans/L4-20-paiement-refuse.md, Contenu : « retour vers l'écran compte ». Propriété de
// pile (CLAUDE.md §8) : seul expo-router/testing-library rend la VRAIE pile. Le parcours appuie
// sur ce qu'une personne appuierait : « Régler » sur la carte de l'abonnement, puis le retour de
// l'en-tête. Un test par fichier (CLAUDE.md §8).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

afterEach(() => {
  jest.useRealTimers();
});

it('« Régler » d’un abonnement impayé ouvre l’écran 20 ; son retour ramène au compte', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({
      profilActif: 'client',
      clientExiste: true,
      clientOnboardingEtape: 5,
      coachExiste: false,
    }),
  );
  const id = detailAbonnementImpayeDemonstration.id;
  portDonnees.definirAbonnementsPourTest([
    {
      id,
      coachPrenom: 'Yannick',
      coachNom: 'Berthaud',
      offreTitre: 'Suivi complet',
      prixFigeCentimes: 4900,
      statut: 'impaye',
      prochainPrelevementLe: null,
      pauseJusquLe: null,
      finAccesLe: null,
    },
  ]);
  portDonnees.definirDetailAbonnementPourTest({ [id]: { ...detailAbonnementImpayeDemonstration } });

  function RacineFaux() {
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
  }

  const rendu = await renderRouter(
    { appDir: './app', overrides: { _layout: RacineFaux } },
    { initialUrl: '/(client)/(tabs)/moi' },
  );
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(screen.queryByText('PAIEMENT REFUSÉ')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Régler' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe(`/abonnement/${id}/refus`));
  await waitFor(() => expect(screen.queryByText('Ta banque a refusé le paiement')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Retour' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/moi'));
});
