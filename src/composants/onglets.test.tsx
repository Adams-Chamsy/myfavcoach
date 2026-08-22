import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { mouvement, taille } from '@/theme/tokens';
import { Onglets } from './onglets';

// withTiming reel demarre une animation asynchrone (voir src/composants/bouton.test.tsx) :
// mocke pour renvoyer sa cible directement et pouvoir verifier QUEL appel est fait.
jest.mock('react-native-reanimated', () => {
  const reel = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...reel, withTiming: jest.fn((valeur) => valeur) };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- doit suivre le jest.mock ci-dessus
const { withTiming } = require('react-native-reanimated');

// jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled') + jest.restoreAllMocks() ne restaure
// pas fiablement l'implementation d'origine (voir src/composants/progression.test.tsx) :
// reference sauvegardee/restauree directement.
const isReduceMotionEnabledOriginal = AccessibilityInfo.isReduceMotionEnabled;

afterEach(() => {
  AccessibilityInfo.isReduceMotionEnabled = isReduceMotionEnabledOriginal;
  withTiming.mockClear();
});

const OPTIONS = [
  { valeur: 'offres', libelle: 'Offres' },
  { valeur: 'avis', libelle: 'Avis' },
  { valeur: 'parcours', libelle: 'Parcours' },
] as const;

function rendreOnglets(valeurActive: (typeof OPTIONS)[number]['valeur'], onChangement = () => {}) {
  return render(
    <FournisseurTheme>
      <Onglets options={[...OPTIONS]} valeurActive={valeurActive} onChangement={onChangement} />
    </FournisseurTheme>,
  );
}

describe('Onglets', () => {
  it('rend les trois options', async () => {
    await rendreOnglets('offres');

    expect(screen.getByText('Offres')).toBeTruthy();
    expect(screen.getByText('Avis')).toBeTruthy();
    expect(screen.getByText('Parcours')).toBeTruthy();
  });

  it("expose l'onglet actif comme selectionne, les autres non", async () => {
    await rendreOnglets('avis');

    const onglets = screen.getAllByRole('tab');
    const etats = onglets.map((o) => o.props.accessibilityState?.selected);

    expect(etats).toEqual([false, true, false]);
  });

  it('appelle onChangement avec la valeur de l’onglet presse', async () => {
    const onChangement = jest.fn();
    await rendreOnglets('offres', onChangement);

    await fireEvent.press(screen.getByText('Parcours'));

    expect(onChangement).toHaveBeenCalledWith('parcours');
  });

  it('a une cible de tap d’au moins 44 par onglet (taille.tapMin)', async () => {
    await rendreOnglets('offres');

    const onglets = screen.getAllByRole('tab');
    for (const onglet of onglets) {
      const style = Array.isArray(onglet.props.style)
        ? Object.assign({}, ...onglet.props.style)
        : onglet.props.style;
      expect(style.minHeight).toBeGreaterThanOrEqual(taille.tapMin);
    }
  });

  it('anime le glissement de l’indicateur vers l’onglet presse, sur mouvement.entree', async () => {
    await rendreOnglets('offres');
    // surChangement n'anime que s'il connait deja la position de l'onglet presse (mesuree
    // via onLayout, qui ne se declenche pas tout seul dans cet environnement de test).
    await fireEvent(screen.getByText('Parcours').parent!, 'layout', {
      nativeEvent: { layout: { x: 160, y: 0, width: 80, height: 44 } },
    });

    await fireEvent.press(screen.getByText('Parcours'));

    expect(withTiming).toHaveBeenCalledWith(expect.anything(), {
      duration: mouvement.entree,
      easing: expect.anything(),
    });
  });

  it('ne fait glisser aucun indicateur (withTiming jamais appele) quand le mouvement reduit est actif', async () => {
    AccessibilityInfo.isReduceMotionEnabled = jest.fn().mockResolvedValue(true);
    await rendreOnglets('offres');
    // Le passage a l'etat "actif" du hook est asynchrone : on attend le re-rendu.
    await screen.findByText('Offres');
    await fireEvent(screen.getByText('Parcours').parent!, 'layout', {
      nativeEvent: { layout: { x: 160, y: 0, width: 80, height: 44 } },
    });

    await fireEvent.press(screen.getByText('Parcours'));

    expect(withTiming).not.toHaveBeenCalled();
  });
});
