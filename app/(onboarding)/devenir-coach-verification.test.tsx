import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import DevenirCoachVerification from './devenir-coach-verification';

const mockPousser = jest.fn();
const mockGetDocumentAsync = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPousser, canGoBack: () => true, back: jest.fn() }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

async function rendre(piecesDeposees: { type: string; deposeLe: string }[]) {
  const portAuth = creerFauxPortAuth();
  await portAuth.inscrire('coach@mfc.test', 'un-mot-de-passe-suffisant', '1990-01-01');
  portAuth.verifierEmailPourTest('coach@mfc.test');
  await portAuth.connecter('coach@mfc.test', 'un-mot-de-passe-suffisant');

  const portDonnees = creerFauxPortDonnees();
  portDonnees.definirEtatProfilsPourTest(
    etatProfilsParDefaut({ coachExiste: true, profilActif: 'coach' }),
  );
  portDonnees.definirPiecesDeposeesPourTest(
    piecesDeposees as Parameters<typeof portDonnees.definirPiecesDeposeesPourTest>[0],
  );

  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <FournisseurSession port={portAuth}>
          <FournisseurDonnees port={portDonnees}>
            <DevenirCoachVerification />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText('Trois documents.')).toBeTruthy());
  return { portDonnees };
}

describe('L2-06 · Devenir coach — étape 3/4 (vérification)', () => {
  beforeEach(() => {
    mockGetDocumentAsync.mockReset();
  });

  it('choisit un fichier valide : dépose réellement la pièce, plus de bouton "Choisir un fichier" pour cette ligne', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/piece.pdf',
          name: 'piece.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      ],
    });
    const { portDonnees } = await rendre([]);

    await fireEvent.press(screen.getAllByText('Choisir un fichier')[0]);

    await waitFor(async () =>
      expect((await portDonnees.lirePiecesDeposees()).map((p) => p.type)).toContain('identite'),
    );
    await waitFor(() => expect(screen.getByText(/Déposée le/)).toBeTruthy());
  });

  it('refuse un fichier de plus de 10 Mo, sans jamais appeler deposerPieceVerification', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/trop-gros.pdf',
          name: 'trop-gros.pdf',
          mimeType: 'application/pdf',
          size: 11 * 1024 * 1024,
        },
      ],
    });
    const { portDonnees } = await rendre([]);

    await fireEvent.press(screen.getAllByText('Choisir un fichier')[0]);

    await waitFor(() =>
      expect(screen.getByText('Ce fichier dépasse 10 Mo. Choisis-en un plus léger.')).toBeTruthy(),
    );
    expect(await portDonnees.lirePiecesDeposees()).toEqual([]);
  });

  it('nomme précisément ce qui manque tant que les trois documents ne sont pas déposés', async () => {
    await rendre([{ type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' }]);

    await waitFor(() =>
      expect(
        screen.getByText('Il manque diplôme ou certification et attestation d’assurance rc pro.'),
      ).toBeTruthy(),
    );
  });

  it('« Continuer » devient actif une fois les trois documents déposés', async () => {
    await rendre([
      { type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' },
      { type: 'diplome_ou_certification', deposeLe: '2026-09-10T10:01:00.000Z' },
      { type: 'assurance_rc_pro', deposeLe: '2026-09-10T10:02:00.000Z' },
    ]);

    await waitFor(() => expect(screen.queryByText(/Il manque/)).toBeNull());
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(mockPousser).toHaveBeenCalledWith('/(onboarding)/devenir-coach-recapitulatif');
  });
});
