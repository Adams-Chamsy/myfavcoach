import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { VERSION_CGU_ACCEPTEE } from '@/fonctionnalites/identite/documents-legaux';
import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import type { EtatProfils } from '@/services/donnees/port';
import { FournisseurTheme } from '@/theme/fournisseur';
import Documents from './documents';

const mockPousser = jest.fn();
const mockRetour = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPousser, back: mockRetour, canGoBack: () => true }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function rendre(
  surcharges: Partial<EtatProfils> = {},
  dates: { cguVersionAcceptee: string; creeLe: string } = {
    cguVersionAcceptee: VERSION_CGU_ACCEPTEE,
    creeLe: '2026-01-01T00:00:00.000Z',
  },
) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('camille@exemple.fr', 'bon-mot-de-passe', '2000-01-01');
  portAuth.verifierEmailPourTest('camille@exemple.fr');
  await portAuth.connecter('camille@exemple.fr', 'bon-mot-de-passe');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ clientExiste: true, ...surcharges }),
  );
  portDonnees.definirDatesDocumentsPourTest(dates);

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <Documents />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );

  await waitFor(() =>
    expect(screen.queryByText("Conditions générales d'utilisation")).toBeTruthy(),
  );
}

describe('Documents contractuels, surface authentifiée (docs/ecrans/L2-03-documents-contractuels.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('affiche les trois documents toujours présents, sans le contrat coach', async () => {
    await rendre({ coachExiste: false });

    expect(screen.getByText("Conditions générales d'utilisation")).toBeTruthy();
    expect(screen.getByText('Conditions générales de vente')).toBeTruthy();
    expect(screen.getByText('Politique de confidentialité')).toBeTruthy();
    expect(screen.queryByText('Contrat coach')).toBeNull();
  });

  // Critère 3 : le contrat coach n'apparaît que pour un compte avec un profil coach.
  it('affiche le contrat coach seulement si le compte a un profil coach', async () => {
    await rendre({ coachExiste: true });

    expect(screen.getByText('Contrat coach')).toBeTruthy();
  });

  it('les CGU/CGV affichent « acceptée le », la confidentialité affiche « mise à jour le »', async () => {
    await rendre({ coachExiste: true });

    expect(screen.getAllByText(/acceptée le/).length).toBe(2);
    expect(screen.getAllByText(/Mise à jour le/).length).toBe(2);
  });

  // Critère 4 : le bandeau n'apparaît QUE si la version acceptée diffère de la version courante.
  it('n’affiche aucun bandeau quand la version acceptée est à jour', async () => {
    await rendre(
      { coachExiste: false },
      {
        cguVersionAcceptee: VERSION_CGU_ACCEPTEE,
        creeLe: '2026-01-01T00:00:00.000Z',
      },
    );

    expect(screen.queryByText(/ont été mises à jour/)).toBeNull();
  });

  it('affiche le bandeau « Une version a changé » quand la version acceptée diffère', async () => {
    await rendre(
      { coachExiste: false },
      {
        cguVersionAcceptee: '2020-01-01',
        creeLe: '2020-01-01T00:00:00.000Z',
      },
    );

    await waitFor(() => expect(screen.queryByText(/ont été mises à jour/)).toBeTruthy());
    await fireEvent.press(screen.getByText('Voir ce qui change'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/cgu');
  });

  // Critère 2 (l'autre moitié, la ligne côté L1-07 est testée par ecran-compte.test.tsx) :
  // chaque ligne ouvre le lecteur public — jamais un second lecteur dupliqué ici.
  it('chaque ligne ouvre le lecteur public correspondant', async () => {
    await rendre({ coachExiste: true });

    await fireEvent.press(screen.getByLabelText('Politique de confidentialité'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/confidentialite');

    await fireEvent.press(screen.getByLabelText('Contrat coach'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/contrat-coach');
  });

  it('n’affiche aucune action d’acceptation', async () => {
    await rendre();

    expect(screen.queryByText('Accepter')).toBeNull();
  });

  it('le bouton retour appelle router.back()', async () => {
    await rendre();
    await fireEvent.press(screen.getByLabelText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
