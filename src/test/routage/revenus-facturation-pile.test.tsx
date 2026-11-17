import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Stack } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';

// docs/ecrans/L5-13-revenus.md, formulaire : « Enregistré : retour à Revenus, qui relit. »
// Propriété de pile (CLAUDE.md §8) : Revenus reste monté sous le formulaire ; seul
// expo-router/testing-library rend la VRAIE pile. Trouvé dans le navigateur le 17 novembre 2026 :
// la carte « Tes informations de facturation » restait affichée après l'enregistrement. Le
// parcours appuie sur ce qu'une personne appuierait. Un test par fichier (CLAUDE.md §8).
const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

afterEach(() => {
  jest.useRealTimers();
});

it('« Renseigner » ouvre le formulaire ; après « Enregistrer », retour à Revenus, qui n’affiche plus la carte', async () => {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('yannick@exemple.fr', 'bon-mot-de-passe', '1985-01-01');
  portAuth.verifierEmailPourTest('yannick@exemple.fr');
  await portAuth.connecter('yannick@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ profilActif: 'coach', coachExiste: true, clientExiste: false }),
  );
  portDonnees.definirIdentificationPourTest({
    compteVersement: 'operationnel',
    identiteFiscaleComplete: false,
    peutPublier: false,
  });

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
    { initialUrl: '/(coach)/(tabs)/revenus' },
  );
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(screen.queryByText('Tes informations de facturation')).toBeTruthy());

  await fireEvent.press(screen.getByRole('button', { name: 'Renseigner' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/facturation'));
  await waitFor(() => expect(screen.queryByLabelText('SIREN')).toBeTruthy());

  // Ce que le serveur rendrait après l'enregistrement.
  portDonnees.definirIdentificationPourTest({
    compteVersement: 'operationnel',
    identiteFiscaleComplete: true,
    peutPublier: true,
  });
  await fireEvent.changeText(screen.getByLabelText('SIREN'), '732829320');
  await fireEvent.press(screen.getByRole('button', { name: 'Franchise en base de TVA' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));
  await act(() => jest.runAllTimersAsync());
  await waitFor(() => expect(rendu.getPathname()).toBe('/revenus'));
  // Revenus a relu (le solde est là) et la carte n'y est plus.
  await waitFor(() => expect(screen.queryByText('Solde disponible')).toBeTruthy());
  await waitFor(() => expect(screen.queryByText('Tes informations de facturation')).toBeNull());
});
