import { act, render } from '@testing-library/react-native';
import { FournisseurMouvementReduit, FournisseurTheme } from '@/theme/fournisseur';
import { SignatureMarque } from './ouverture-marque';

describe('la signature rend toujours l’interaction à l’application', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it.each([
    [true, false, 2200],
    [false, false, 600],
    [true, true, 150],
  ] as const)('longue=%s, mouvements réduits=%s : finit à %d ms', async (longue, reduit, duree) => {
    const terminer = jest.fn();
    await render(
      <FournisseurTheme>
        <FournisseurMouvementReduit force={reduit}>
          <SignatureMarque longue={longue} mouvementReduit={reduit} onTerminee={terminer} />
        </FournisseurMouvementReduit>
      </FournisseurTheme>,
    );
    await act(() => jest.advanceTimersByTimeAsync(duree - 1));
    expect(terminer).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTimeAsync(1));
    expect(terminer).toHaveBeenCalledTimes(1);
  });
  it('une interruption nettoie la fin programmée et ne rappelle pas un écran démonté', async () => {
    const terminer = jest.fn();
    const rendu = await render(
      <FournisseurTheme>
        <FournisseurMouvementReduit force={false}>
          <SignatureMarque longue onTerminee={terminer} />
        </FournisseurMouvementReduit>
      </FournisseurTheme>,
    );
    await rendu.unmount();
    await act(() => jest.runAllTimersAsync());
    expect(terminer).not.toHaveBeenCalled();
  });
});
