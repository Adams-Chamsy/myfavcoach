import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { seancesDemonstration } from '@/fixtures/demonstration';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L6-05-seance-du-jour.md, « Le bloc de l'accueil » : « Faite » une fois la séance
// faite. Propriété de pile (CLAUDE.md §8) : l'accueil reste monté sous la séance. Trouvé dans le
// navigateur le 17 novembre 2026 : la carte proposait encore « Commencer ». Le parcours appuie sur
// ce qu'une personne appuierait. Un test par fichier (CLAUDE.md §8). La séance a un chronomètre
// (setInterval) : une fois ouverte, le temps avance d'une durée fixe, jamais « tous les minuteurs ».
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

afterEach(() => {
  jest.useRealTimers();
});

it('« Reprendre » sur l’accueil, « Terminer la séance », « Enregistrer » : de retour, la carte dit « Faite »', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('lina@exemple.fr', 'bon-mot-de-passe', '1995-06-15');
  portAuth.verifierEmailPourTest('lina@exemple.fr');
  await portAuth.connecter('lina@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'client', clientExiste: true, clientOnboardingEtape: 5 }),
  );
  const demo = seancesDemonstration[0]!;
  portDonnees.definirSeanceClientPourTest(
    {
      id: 'sp-1',
      titre: demo.titre,
      dureeMinutes: demo.dureeMinutes,
      datePrevue: '2026-11-17',
      statut: 'en_cours',
      demarreeLe: new Date().toISOString(),
      rattrapee: false,
      coachPrenom: 'Yannick',
      coachNom: 'Berthaud',
      nombreExercices: 1,
      duJour: true,
    },
    [
      {
        id: 'ex-squat',
        ordre: 1,
        nom: 'Squat gobelet',
        series: 1,
        repetitions: 12,
        chargeGrammes: 12000,
        consigne: '',
        mediaChemin: null,
        mediaTypeMime: null,
      },
    ],
  );

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
    { initialUrl: '/(client)/(tabs)/accueil' },
  );
  await act(() => jest.runAllTimersAsync());
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: `Reprendre ${demo.titre}` })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole('button', { name: `Reprendre ${demo.titre}` }));
  await act(() => jest.advanceTimersByTimeAsync(1000));
  await waitFor(() => expect(rendu.getPathname()).toBe('/seance/sp-1'));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Terminer la séance' })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Terminer la séance' }));
  await act(() => jest.advanceTimersByTimeAsync(1000));
  await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
  await act(() => jest.advanceTimersByTimeAsync(1000));
  await waitFor(() => expect(rendu.getPathname()).toBe('/accueil'));
  await waitFor(() => expect(screen.queryByText('Faite')).toBeTruthy());
  expect(screen.queryByRole('button', { name: `Reprendre ${demo.titre}` })).toBeNull();
});
