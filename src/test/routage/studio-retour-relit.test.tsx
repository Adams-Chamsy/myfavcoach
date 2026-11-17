import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L6-11-studio.md : le programme montre ses séances telles qu'elles sont. Propriété de
// pile (CLAUDE.md §8) : le programme reste monté sous la séance ; seul expo-router/testing-library
// rend la VRAIE pile. Trouvé dans le navigateur le 17 novembre 2026 : une séance renommée restait
// « Séance sans titre » au retour. Un test par fichier (CLAUDE.md §8).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

afterEach(() => {
  jest.useRealTimers();
});

it('une séance renommée, puis « Retour » : le programme montre le nouveau titre', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('yannick@exemple.fr', 'bon-mot-de-passe', '1985-01-01');
  portAuth.verifierEmailPourTest('yannick@exemple.fr');
  await portAuth.connecter('yannick@exemple.fr', 'bon-mot-de-passe');
  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true, clientExiste: false }),
  );
  await portDonnees.creerProgramme();
  await portDonnees.ajouterSeance('programme-1', 1);

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
    { initialUrl: '/(coach)/studio/programme-1' },
  );
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(screen.queryByText('Séance sans titre')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: /^Lun, Séance sans titre/ }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/studio/seance/seance-2'));
  await waitFor(() => expect(screen.queryByText('Semaine 1 · Lun')).toBeTruthy());
  const titres = screen.getAllByLabelText('Titre');
  await fireEvent.changeText(titres[titres.length - 1]!, 'Bas du corps');
  await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer la séance' }));
  await act(() => jest.runAllTimersAsync());

  await fireEvent.press(screen.getAllByRole('button', { name: 'Retour' }).pop()!);
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/studio/programme-1'));
  await waitFor(() => expect(screen.queryByText('Bas du corps')).toBeTruthy());
  expect(screen.queryByText('Séance sans titre')).toBeNull();
});
