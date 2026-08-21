import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { mouvement, taille } from '@/theme/tokens';
import { Bouton, type VarianteBouton } from './bouton';

// withTiming reel demarre une animation asynchrone (impossible a observer en synchrone dans
// un test) : mocke pour renvoyer sa cible directement, afin de verifier QUEL appel est fait
// (ou non) plutot que la valeur animee a un instant donne.
jest.mock('react-native-reanimated', () => {
  const reel = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...reel, withTiming: jest.fn((valeur) => valeur) };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- doit suivre le jest.mock ci-dessus
const { withTiming } = require('react-native-reanimated');

function rendreBouton(proprietes: Partial<React.ComponentProps<typeof Bouton>> = {}) {
  return render(
    <FournisseurTheme>
      <Bouton libelle="Continuer" onPress={() => {}} {...proprietes} />
    </FournisseurTheme>,
  );
}

const VARIANTES: VarianteBouton[] = ['primaire', 'secondaire', 'discret', 'accent'];

describe('Bouton', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    withTiming.mockClear();
  });

  it.each(VARIANTES)('rend la variante %s avec son libelle', async (variante) => {
    await rendreBouton({ variante });
    expect(screen.getByText('Continuer')).toBeTruthy();
  });

  it("n'appelle pas onPress quand il est desactive", async () => {
    const onPress = jest.fn();
    await rendreBouton({ onPress, desactive: true });

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('appelle onPress quand il est actif', async () => {
    const onPress = jest.fn();
    await rendreBouton({ onPress });

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a une zone de tap d’au moins 44 (taille.tapMin)', async () => {
    await rendreBouton();

    const bouton = screen.getByRole('button');
    const style = Array.isArray(bouton.props.style)
      ? Object.assign({}, ...bouton.props.style)
      : bouton.props.style;

    expect(style.minHeight).toBeGreaterThanOrEqual(taille.tapMin);
  });

  it('anime l’appui vers mouvement.echelleAppui quand le mouvement reduit est inactif', async () => {
    await rendreBouton();

    fireEvent(screen.getByRole('button'), 'pressIn');

    expect(withTiming).toHaveBeenCalledWith(mouvement.echelleAppui, expect.anything());
  });

  it('n’anime PAS l’appui (withTiming jamais appele) quand le mouvement reduit est actif', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await rendreBouton();
    // Le passage a l'etat "actif" du hook est asynchrone (lecture initiale du reglage
    // systeme) : on attend le re-rendu avant de simuler l'appui.
    const bouton = await screen.findByRole('button');

    fireEvent(bouton, 'pressIn');

    expect(withTiming).not.toHaveBeenCalled();
  });
});
