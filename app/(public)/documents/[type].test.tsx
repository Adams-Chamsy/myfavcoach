import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurTheme } from '@/theme/fournisseur';
import DocumentLegalPublic from './[type]';

const mockRetour = jest.fn();
const mockRemplacer = jest.fn();
let mockPeutRevenir = true;
let mockTypeCourant = 'cgu';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ type: mockTypeCourant }),
  useRouter: () => ({ back: mockRetour, replace: mockRemplacer, canGoBack: () => mockPeutRevenir }),
}));

const METRIQUES_ZONES_SURES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};

// Bouton (react-native-reanimated) est monté même sur cet écran sans aucune donnée
// asynchrone : le même piège s'applique (CLAUDE.md §8, « await CHAQUE fireEvent, waitFor +
// queryBy jamais findBy ») — render() seul, sans un waitFor qui suit, laisse échouer
// « render function has not been called ».
async function rendre() {
  render(
    <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
      <FournisseurTheme>
        <DocumentLegalPublic />
      </FournisseurTheme>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.queryByText('Retour')).toBeTruthy());
}

describe('Document légal, surface publique (docs/ecrans/L2-03-documents-contractuels.md)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTypeCourant = 'cgu';
  });

  // Critère 1 : accessible sans session — aucun FournisseurSession/FournisseurDonnees n'englobe
  // cet écran dans ce test, contrairement à tous les écrans de (compte).
  it('affiche le titre, la version et le corps du document, sans aucune session', async () => {
    await rendre();

    expect(screen.getByText("Conditions générales d'utilisation")).toBeTruthy();
    expect(screen.getByText(/Version du/)).toBeTruthy();
    expect(screen.getByText(/n'est pas encore rédigé/)).toBeTruthy();
  });

  it.each(['cgu', 'cgv', 'confidentialite', 'contrat-coach'])(
    'affiche le document « %s »',
    async (type) => {
      mockTypeCourant = type;
      await rendre();
      expect(screen.queryByText(/n'est pas encore rédigé/)).toBeTruthy();
    },
  );

  it('un type inconnu affiche un état vide, jamais une page blanche', async () => {
    mockTypeCourant = 'inexistant';
    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <DocumentLegalPublic />
        </FournisseurTheme>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.queryByText('Document introuvable')).toBeTruthy());
  });

  // 2 novembre 2026 : l'état « Document introuvable » n'avait aucune sortie, alors que le rendu
  // normal a son bouton retour (docs/dette.md, recherche des sorties présentes dans une seule
  // branche). Atteint par un lien venu de l'extérieur, rien n'est derrière lui dans la pile :
  // « Retour » ramène alors à l'accueil plutôt que de ne rien faire.
  it('un type inconnu a aussi un bouton « Retour », qui revient en arrière s’il y a un écran derrière', async () => {
    mockTypeCourant = 'inexistant';
    mockPeutRevenir = true;
    mockRetour.mockClear();
    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <DocumentLegalPublic />
        </FournisseurTheme>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.queryByText('Document introuvable')).toBeTruthy());
    await fireEvent.press(screen.getByText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });

  it('atteint par un lien, sans écran derrière : « Retour » ramène à l’accueil, jamais un bouton qui ne fait rien', async () => {
    mockTypeCourant = 'inexistant';
    mockPeutRevenir = false;
    mockRetour.mockClear();
    mockRemplacer.mockClear();
    render(
      <SafeAreaProvider initialMetrics={METRIQUES_ZONES_SURES}>
        <FournisseurTheme>
          <DocumentLegalPublic />
        </FournisseurTheme>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.queryByText('Document introuvable')).toBeTruthy());
    await fireEvent.press(screen.getByText('Retour'));
    expect(mockRetour).not.toHaveBeenCalled();
    expect(mockRemplacer).toHaveBeenCalledWith('/');
    mockPeutRevenir = true;
  });

  // Critère 5 : aucune action d'acceptation sur cette surface.
  it('n’affiche aucune action d’acceptation, seulement un retour', async () => {
    await rendre();

    expect(screen.queryByText('Accepter')).toBeNull();
    expect(screen.queryByText('J’accepte')).toBeNull();
    await fireEvent.press(screen.getByText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
