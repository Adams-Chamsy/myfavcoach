import { render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { Squelette, type FormeSquelette } from './squelette';

jest.mock('react-native-reanimated', () => {
  const reel = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...reel,
    withRepeat: jest.fn((animation) => animation),
    withTiming: jest.fn((valeur) => valeur),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- doit suivre le jest.mock ci-dessus
const { withRepeat } = require('react-native-reanimated');

const FORMES: FormeSquelette[] = ['liste', 'carte', 'detail', 'ligne'];

describe('Squelette', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    withRepeat.mockClear();
  });

  it.each(FORMES)('rend la forme %s sans erreur', async (forme) => {
    const { toJSON } = await render(
      <FournisseurTheme>
        <Squelette forme={forme} />
      </FournisseurTheme>,
    );

    expect(toJSON()).toBeTruthy();
  });

  it('demarre la pulsation en boucle quand le mouvement reduit est inactif', async () => {
    await render(
      <FournisseurTheme>
        <Squelette forme="ligne" />
      </FournisseurTheme>,
    );

    expect(withRepeat).toHaveBeenCalled();
  });

  it("fixe l'opacite a 1 (pas de pulsation) une fois le mouvement reduit resolu actif", async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    await render(
      <FournisseurTheme>
        <Squelette forme="ligne" testID="squelette" />
      </FournisseurTheme>,
    );

    // useMouvementReduit demarre a "inactif" le temps de lire le reglage systeme (async) :
    // on attend l'etat stabilise plutot que de compter les appels transitoires a withRepeat.
    await waitFor(() => {
      const style = screen.getByTestId('squelette', { includeHiddenElements: true }).props.style;
      const opacite = Array.isArray(style) ? Object.assign({}, ...style).opacity : style.opacity;
      expect(opacite).toBe(1);
    });
  });

  it("est masque du lecteur d'ecran (formes decoratives, pas de contenu reel)", async () => {
    await render(
      <FournisseurTheme>
        <Squelette forme="ligne" testID="squelette" />
      </FournisseurTheme>,
    );

    expect(
      screen.getByTestId('squelette', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no-hide-descendants');
  });
});
