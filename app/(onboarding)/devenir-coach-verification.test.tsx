import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { creerFauxPortAuth } from '@/services/auth/faux';
import { creerFauxPortDonnees, etatProfilsParDefaut } from '@/services/donnees/faux';
import { FournisseurTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';
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

async function rendre(
  piecesDeposees: {
    type: string;
    deposeLe: string;
    nomFichier?: string | null;
    tailleOctets?: number | null;
  }[],
  dossier?: Parameters<
    ReturnType<typeof creerFauxPortDonnees>['definirDossierVerificationPourTest']
  >[0],
  saboter?: (port: ReturnType<typeof creerFauxPortDonnees>) => void,
) {
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
  if (dossier) portDonnees.definirDossierVerificationPourTest(dossier);
  saboter?.(portDonnees);

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

  // A1 (2 novembre 2026), décision du développeur : la soumission est automatique, et l'écran le
  // dit au moment où elle arrive — « sinon il ne sait pas ce qu'il vient de déclencher ». Texte
  // validé le même jour.
  it('le troisième document déposé : l’écran dit que le dossier part en examen, avec l’échéance', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/a.pdf', name: 'a.pdf', mimeType: 'application/pdf', size: 1 }],
    });
    await rendre([
      { type: 'identite', deposeLe: '2026-11-02T10:00:00.000Z' },
      { type: 'diplome_ou_certification', deposeLe: '2026-11-02T10:01:00.000Z' },
    ]);
    expect(screen.queryByText('Ton dossier est complet, il part en examen.')).toBeNull();

    await fireEvent.press(screen.getByText('Choisir un fichier'));

    await waitFor(() =>
      expect(screen.queryByText('Ton dossier est complet, il part en examen.')).toBeTruthy(),
    );
    expect(
      screen.getByText(/^On te répond sous 48 h ouvrées, d’ici le \d{2}\/\d{2}\/\d{4}\.$/),
    ).toBeTruthy();
  });

  it('un document déposé sans compléter le dossier : aucun message de soumission', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/a.pdf', name: 'a.pdf', mimeType: 'application/pdf', size: 1 }],
    });
    await rendre([]);

    await fireEvent.press(screen.getAllByText('Choisir un fichier')[0]);

    await waitFor(() => expect(screen.getByText(/Déposée le/)).toBeTruthy());
    expect(screen.queryByText('Ton dossier est complet, il part en examen.')).toBeNull();
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

  // A2 (2 novembre 2026, docs/dette.md « Impasse : un coach refusé… ») — fiche L2-06 : une pièce
  // déposée affiche l'action « Remplacer » (Contenu, « Déposée ») ; elle efface l'ancienne
  // version sans autre confirmation (critère 4). Sans elle, un coach refusé ne pouvait plus rien
  // redéposer.
  it('une pièce déposée propose « Remplacer » ; un nouveau fichier remplace la date affichée', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/b.pdf', name: 'b.pdf', mimeType: 'application/pdf', size: 1 }],
    });
    const { portDonnees } = await rendre([
      { type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' },
    ]);
    expect(screen.getByText('Déposée le 10/09/2026')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Remplacer la pièce d’identité' }));

    await waitFor(() => expect(screen.queryByText('Déposée le 10/09/2026')).toBeNull());
    expect(screen.getByText(`Déposée le ${new Date().toLocaleDateString('fr-FR')}`)).toBeTruthy();
    const identites = (await portDonnees.lirePiecesDeposees()).filter((p) => p.type === 'identite');
    expect(identites).toHaveLength(2);
  });

  // Le serveur garde chaque dépôt (0012 : « l'ancien dépôt reste une preuve ») et les rend du
  // plus ancien au plus récent : la ligne affiche le dépôt en vigueur, le plus récent.
  it('plusieurs dépôts du même type : la ligne affiche le plus récent', async () => {
    await rendre([
      { type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' },
      { type: 'identite', deposeLe: '2026-10-20T10:00:00.000Z' },
    ]);

    expect(screen.getByText('Déposée le 20/10/2026')).toBeTruthy();
    expect(screen.queryByText('Déposée le 10/09/2026')).toBeNull();
  });

  it('« Remplacer » est présenté comme destructif : encre d’alerte, jamais la couleur d’action', async () => {
    await rendre([{ type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' }]);

    expect(screen.getByText('Remplacer')).toHaveStyle({
      color: themes.clair.etat.erreurEncre,
    });
  });

  // La raison de A2 : un coach refusé redépose les trois pièces, et son dossier repart en examen
  // (0053). Avant A2, aucune des trois lignes n'avait d'action.
  it('un coach refusé remplace ses trois pièces : le dossier repart en examen, et l’écran le dit', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/c.pdf', name: 'c.pdf', mimeType: 'application/pdf', size: 1 }],
    });
    await rendre(
      [
        { type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' },
        { type: 'diplome_ou_certification', deposeLe: '2026-09-10T10:01:00.000Z' },
        { type: 'assurance_rc_pro', deposeLe: '2026-09-10T10:02:00.000Z' },
      ],
      { statut: 'refusee', deposeLe: '2026-09-10T10:02:00.000Z', motif: 'Pièce illisible.' },
    );

    for (const piece of ['la pièce d’identité', 'le diplôme ou la certification']) {
      await fireEvent.press(screen.getByRole('button', { name: `Remplacer ${piece}` }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: `Remplacer ${piece}` })).toBeEnabled(),
      );
    }
    expect(screen.queryByText('Ton dossier est complet, il part en examen.')).toBeNull();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Remplacer l’attestation d’assurance RC pro' }),
    );

    await waitFor(() =>
      expect(screen.queryByText('Ton dossier est complet, il part en examen.')).toBeTruthy(),
    );
  });

  // L2-06, Contenu (« Déposée » : coche, nom du fichier, date de dépôt, poids) — décision du
  // développeur du 12 novembre 2026. Une pièce déposée avant cette date n'a ni nom ni poids :
  // la ligne montre alors la date seule.
  it('une pièce déposée affiche le nom du fichier, la date et le poids', async () => {
    await rendre([
      {
        type: 'identite',
        deposeLe: '2026-09-12T10:00:00.000Z',
        nomFichier: 'passeport.pdf',
        tailleOctets: 1468006,
      },
      { type: 'diplome_ou_certification', deposeLe: '2026-09-12T10:01:00.000Z' },
    ]);

    expect(screen.getByText('passeport.pdf')).toBeTruthy();
    expect(screen.getByText('Déposée le 12/09/2026 · 1,4 Mo')).toBeTruthy();
    expect(screen.getByText('Déposée le 12/09/2026')).toBeTruthy();
  });

  // Décidé le 13 novembre 2026 : une lecture qui échoue affiche une erreur, jamais une valeur par
  // défaut. La lecture des pièces au montage n'avait aucun `catch` : l'écran restait sur son
  // squelette, sans fin ni message.
  it('la lecture des pièces en échec : l’erreur avec « Réessayer » ; au second essai, les lignes', async () => {
    await rendre(
      [{ type: 'identite', deposeLe: '2026-09-10T10:00:00.000Z' }],
      undefined,
      (port) => {
        jest.spyOn(port, 'lirePiecesDeposees').mockRejectedValueOnce(new Error('panne'));
      },
    );

    await waitFor(() => expect(screen.queryByText('On a un souci de notre côté')).toBeTruthy());
    expect(screen.queryByText(/Déposée le/)).toBeNull();

    await fireEvent.press(screen.getByText('Réessayer'));

    await waitFor(() => expect(screen.queryByText('Déposée le 10/09/2026')).toBeTruthy());
  });
});
