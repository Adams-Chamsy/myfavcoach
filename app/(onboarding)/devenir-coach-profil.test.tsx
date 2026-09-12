import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import DevenirCoachProfil from './devenir-coach-profil';

const mockPousser = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPousser, canGoBack: () => true, back: jest.fn() }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

describe('L2-05 · Devenir coach — étape 2/4 (profil)', () => {
  async function rendre() {
    const portAuth = creerFauxPortAuth();
    await portAuth.inscrire('coach@mfc.test', 'un-mot-de-passe-suffisant', '1990-01-01');
    portAuth.verifierEmailPourTest('coach@mfc.test');
    await portAuth.connecter('coach@mfc.test', 'un-mot-de-passe-suffisant');
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ coachExiste: true, profilActif: 'coach' }),
    );

    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <FournisseurSession port={portAuth}>
            <FournisseurDonnees port={portDonnees}>
              <DevenirCoachProfil />
            </FournisseurDonnees>
          </FournisseurSession>
        </FournisseurTheme>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText('Présente-toi.')).toBeTruthy());
    return { portDonnees };
  }

  it('« Continuer » reste inactif tant que titre court et bio ne sont pas remplis, puis enregistre et enchaîne sur l’étape 3', async () => {
    await rendre();

    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(mockPousser).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Titre court'), 'Préparateur physique');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(mockPousser).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Bio'), 'Dix ans d’expérience.');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() =>
      expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/devenir-coach-verification'),
    );
  });
});
