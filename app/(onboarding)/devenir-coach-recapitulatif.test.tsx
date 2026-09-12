import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import DevenirCoachRecapitulatif from './devenir-coach-recapitulatif';

const mockRemplacer = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRemplacer, canGoBack: () => true, back: jest.fn() }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

describe('L2-07 · Devenir coach — étape 4/4 (c’est parti)', () => {
  it('le bouton mène toujours à l’écran 19, aucune mention bancaire (IBAN, coordonnées)', async () => {
    const portAuth = creerFauxPortAuth();
    await portAuth.inscrire('coach@mfc.test', 'un-mot-de-passe-suffisant', '1990-01-01');
    portAuth.verifierEmailPourTest('coach@mfc.test');
    await portAuth.connecter('coach@mfc.test', 'un-mot-de-passe-suffisant');
    const portDonnees = creerFauxPortDonnees();
    portDonnees.definirEtatProfilsPourTest(
      etatProfilsParDefaut({ coachExiste: true, profilActif: 'coach' }),
    );
    portDonnees.definirInformationsPourTest({
      profil: 'coach',
      prenom: 'Nadia',
      nom: 'Belkacem',
      discipline: 'cybersecurite',
      titreCourt: 'Sécurité offensive',
      bio: 'Dix ans d’expérience.',
      dateNaissance: '1990-01-01',
    });

    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <FournisseurSession port={portAuth}>
            <FournisseurDonnees port={portDonnees}>
              <DevenirCoachRecapitulatif />
            </FournisseurDonnees>
          </FournisseurSession>
        </FournisseurTheme>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByText('C’est parti.')).toBeTruthy());

    // Le prestataire de paiement n'est pas cherché ici : src/test/secrets-interdits.test.ts le
    // garantit déjà, au niveau du code source (aucun import, aucune lecture de sa clé publique)
    // — un texte rendu ne peut de toute façon pas le nommer sans un de ces deux imports.
    const texteEcran = JSON.stringify(screen.toJSON());
    expect(texteEcran).not.toMatch(/iban/i);
    expect(texteEcran).not.toMatch(/coordonnées bancaires/i);

    await fireEvent.press(screen.getByRole('button', { name: 'Aller à mon espace coach' }));
    expect(mockRemplacer).toHaveBeenCalledWith('/(coach)/pilotage');
  });
});
