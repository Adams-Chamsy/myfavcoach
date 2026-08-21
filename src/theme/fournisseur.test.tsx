import { render, renderHook, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { FournisseurTheme, useMouvementReduit, useTheme } from './fournisseur';
import { mouvement, mouvementReduit } from './tokens';

describe('useMouvementReduit', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rend les durees normales quand le reglage systeme est inactif', async () => {
    const { result } = await renderHook(() => useMouvementReduit());

    await waitFor(() => {
      expect(result.current.actif).toBe(false);
    });

    expect(result.current.appui).toBe(mouvement.appui);
    expect(result.current.entree).toBe(mouvement.entree);
    expect(result.current.feuille).toBe(mouvement.feuille);
  });

  it('rend les durees de mouvementReduit quand le reglage systeme est actif', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = await renderHook(() => useMouvementReduit());

    await waitFor(() => {
      expect(result.current.actif).toBe(true);
    });

    expect(result.current.appui).toBe(mouvementReduit.appui);
    expect(result.current.entree).toBe(mouvementReduit.entree);
    expect(result.current.feuille).toBe(mouvementReduit.feuille);
    expect(result.current.valeur).toBe(mouvementReduit.valeur);
    expect(result.current.decalage).toBe(mouvementReduit.decalage);

    // voile et voileOpacite n'existent pas dans mouvementReduit : ce sont des opacites,
    // conservees telles quelles meme en mouvement reduit (docs/design-system.md §4).
    expect(result.current.voile).toBe(mouvement.voile);
    expect(result.current.voileOpacite).toBe(mouvement.voileOpacite);
  });
});

describe('useTheme', () => {
  function ComposantSonde({ onRendu }: { onRendu: (theme: ReturnType<typeof useTheme>) => void }) {
    onRendu(useTheme());
    return null;
  }

  it('leve une erreur explicite hors de FournisseurTheme', async () => {
    const consoleErreur = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(render(<ComposantSonde onRendu={() => {}} />)).rejects.toThrow(
      "useTheme doit etre appele a l'interieur de <FournisseurTheme>.",
    );

    consoleErreur.mockRestore();
  });

  it('rend le theme clair par defaut, sans lire le theme systeme', async () => {
    let themeRendu: ReturnType<typeof useTheme> | undefined;

    await render(
      <FournisseurTheme>
        <ComposantSonde onRendu={(theme) => (themeRendu = theme)} />
      </FournisseurTheme>,
    );

    expect(themeRendu?.couleur.marque.primaire).toBe('#0F5140');
    expect(themeRendu?.couleur.fond.canevas).toBe('#FBF8F4');
  });

  it('rend le theme sombre quand themeForce le demande', async () => {
    let themeRendu: ReturnType<typeof useTheme> | undefined;

    await render(
      <FournisseurTheme themeForce="sombre">
        <ComposantSonde onRendu={(theme) => (themeRendu = theme)} />
      </FournisseurTheme>,
    );

    expect(themeRendu?.couleur.marque.primaire).toBe('#58C2A2');
  });
});
