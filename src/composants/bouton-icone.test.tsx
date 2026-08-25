import { fireEvent, render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { taille } from '@/theme/tokens';
import { BoutonIcone } from './bouton-icone';

function rendreBoutonIcone(proprietes: Partial<React.ComponentProps<typeof BoutonIcone>> = {}) {
  return render(
    <FournisseurTheme>
      <BoutonIcone nom="ajouter" accessibilityLabel="Ajouter" onPress={() => {}} {...proprietes} />
    </FournisseurTheme>,
  );
}

describe('BoutonIcone', () => {
  it('rend avec son accessibilityLabel', async () => {
    await rendreBoutonIcone();
    expect(screen.getByLabelText('Ajouter')).toBeTruthy();
  });

  it("n'appelle pas onPress quand il est desactive", async () => {
    const onPress = jest.fn();
    await rendreBoutonIcone({ onPress, desactive: true });

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('appelle onPress quand il est actif', async () => {
    const onPress = jest.fn();
    await rendreBoutonIcone({ onPress });

    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a un conteneur d’au moins 44 (taille.tapMin)', async () => {
    await rendreBoutonIcone();

    const bouton = screen.getByRole('button');
    const style = Array.isArray(bouton.props.style)
      ? Object.assign({}, ...bouton.props.style)
      : bouton.props.style;

    expect(style.minWidth).toBeGreaterThanOrEqual(taille.tapMin);
    expect(style.minHeight).toBeGreaterThanOrEqual(taille.tapMin);
  });
});

// Le cas "sans accessibilityLabel ne compile pas" vit dans bouton-icone.compilation.tsx, pas
// ici : une erreur de compilation ne s'exécute jamais, donc jamais dans Jest.
