import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { FournisseurTheme } from '@/theme/fournisseur';
import Bienvenue from './index';
import Presentation from './presentation';

const mockPousser = jest.fn();
const mockRemplacer = jest.fn();
const mockRetour = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPousser,
    replace: mockRemplacer,
    back: mockRetour,
    canGoBack: () => true,
  }),
}));
const METRIQUES: Metrics = {
  insets: { top: 59, right: 0, bottom: 34, left: 0 },
  frame: { x: 0, y: 0, width: 393, height: 852 },
};
async function rendre(presentation = false) {
  return render(
    <SafeAreaProvider initialMetrics={METRIQUES}>
      <FournisseurTheme>{presentation ? <Presentation /> : <Bienvenue />}</FournisseurTheme>
    </SafeAreaProvider>,
  );
}

// La fiche L1-01 a été révisée par le GO du 15 novembre : les photos locales remplacent le
// repli obligatoire et les actions Apple factices ; les destinations utilisables sont éprouvées.
describe('accueil visiteur et présentation validés', () => {
  it('permet de découvrir sans compte et sans passer par la présentation', async () => {
    await rendre();
    await fireEvent.press(screen.getByRole('button', { name: 'Découvrir les coachs' }));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/decouvrir');
  });
  it('garde la présentation facultative et la connexion explicites', async () => {
    await rendre();
    await fireEvent.press(screen.getByText('Comment ça marche ?'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/presentation');
    await fireEvent.press(screen.getByTestId('lien-connexion'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/connexion');
  });
  it('conserve le compte unique, l’intention coach et les documents', async () => {
    await rendre();
    await fireEvent.press(screen.getByText('Créer mon compte'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/inscription');
    await fireEvent.press(screen.getByText('Je suis coach'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/inscription?viaCoach=1');
    await fireEvent.press(screen.getByText('CGU'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/cgu');
    await fireEvent.press(screen.getByText('Confidentialité'));
    expect(mockPousser).toHaveBeenCalledWith('/(public)/documents/confidentialite');
  });
  it('explique trouver, comparer et choisir en trois étapes manuelles', async () => {
    await rendre(true);
    expect(screen.getByText('Trouve ton coach.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Suivant'));
    expect(screen.getByText('Compare les offres.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Suivant'));
    expect(screen.getByText('Choisis ton accompagnement.')).toBeTruthy();
    expect(screen.getByLabelText('Étape 3 sur 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Découvrir les coachs' }));
    expect(mockRemplacer).toHaveBeenCalledWith('/(public)/decouvrir');
  });
  it('permet de passer et de revenir sans compléter le carrousel', async () => {
    await rendre(true);
    await fireEvent.press(screen.getByText('Passer'));
    expect(mockRetour).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Étape 2 : Compare les offres.'));
    expect(screen.getByLabelText('Étape 2 sur 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Étape précédente'));
    expect(screen.getByLabelText('Étape 1 sur 3')).toBeTruthy();
  });
  it('ne tronque pas le titre et préserve les cibles de connexion et coach', async () => {
    await rendre();
    expect(screen.getByText('Un vrai coach. Pour avancer.').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('lien-connexion').props.style.minHeight).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId('lien-porte-coach').props.style.minHeight).toBeGreaterThanOrEqual(44);
  });
  it('fournit une alternative à la photo et un repli si elle échoue', async () => {
    await rendre();
    const image = screen.getByLabelText(
      'Une coach échange avec un sportif aux cheveux grisonnants avant une séance en extérieur.',
    );
    await fireEvent(image, 'error');
    expect(screen.getAllByText('Un vrai coach. Pour avancer.')).toHaveLength(2);
  });
});
