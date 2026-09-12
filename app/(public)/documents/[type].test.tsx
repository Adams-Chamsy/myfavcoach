import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { FournisseurTheme } from '@/theme/fournisseur';
import DocumentLegalPublic from './[type]';

const mockRetour = jest.fn();
let mockTypeCourant = 'cgu';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ type: mockTypeCourant }),
  useRouter: () => ({ back: mockRetour }),
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

  // Critère 5 : aucune action d'acceptation sur cette surface.
  it('n’affiche aucune action d’acceptation, seulement un retour', async () => {
    await rendre();

    expect(screen.queryByText('Accepter')).toBeNull();
    expect(screen.queryByText('J’accepte')).toBeNull();
    await fireEvent.press(screen.getByText('Retour'));
    expect(mockRetour).toHaveBeenCalledTimes(1);
  });
});
