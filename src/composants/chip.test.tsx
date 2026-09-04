import { fireEvent, render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { taille } from '@/theme/tokens';
import { Chip } from './chip';

describe('Chip', () => {
  it('rend la variante categorie, non interactive', async () => {
    await render(
      <FournisseurTheme>
        <Chip libelle="Musculation" />
      </FournisseurTheme>,
    );

    expect(screen.getByText('Musculation')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('rend la variante filtre et appelle onPress au tap', async () => {
    const onPress = jest.fn();
    await render(
      <FournisseurTheme>
        <Chip libelle="Certifié" variante="filtre" selectionne={false} onPress={onPress} />
      </FournisseurTheme>,
    );

    await fireEvent.press(screen.getByText('Certifié'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('la croix retirable a sa propre cible de 44, distincte du corps du chip', async () => {
    const onPress = jest.fn();
    const onRetirer = jest.fn();
    await render(
      <FournisseurTheme>
        <Chip
          libelle="Nouveau"
          variante="filtreRetirable"
          selectionne
          onPress={onPress}
          onRetirer={onRetirer}
          accessibilityLabelRetirer="Retirer le filtre Nouveau"
        />
      </FournisseurTheme>,
    );

    const croix = screen.getByLabelText('Retirer le filtre Nouveau');
    await fireEvent.press(croix);

    expect(onRetirer).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    const styleCroix = Array.isArray(croix.props.style)
      ? Object.assign({}, ...croix.props.style)
      : croix.props.style;
    expect(styleCroix.minWidth).toBeGreaterThanOrEqual(taille.tapMin);
    expect(styleCroix.minHeight).toBeGreaterThanOrEqual(taille.tapMin);
  });

  // docs/ecrans/L1-05-onboarding-client.md, étape 2/4 : "hauteur 44, sélectionnée en
  // fond.inverse + coche".
  describe('variante selection', () => {
    it('appelle onPress au tap et respecte une hauteur minimale de 44', async () => {
      const onPress = jest.fn();
      const rendu = await render(
        <FournisseurTheme>
          <Chip
            libelle="Perdre du poids"
            variante="selection"
            selectionne={false}
            onPress={onPress}
          />
        </FournisseurTheme>,
      );

      const chip = screen.getByRole('button', { name: 'Perdre du poids' });
      await fireEvent.press(chip);
      expect(onPress).toHaveBeenCalledTimes(1);

      // Cherche minHeight n'importe où dans l'arbre rendu, plutôt que de supposer une forme
      // précise (View directe vs Pressable) — les deux portent la même contrainte de taille.
      const arbre = JSON.stringify(rendu.toJSON());
      expect(arbre).toContain(`"minHeight":${taille.tapMin}`);
    });

    it('sélectionnée : porte accessibilityState.selected et une icône de coche', async () => {
      await render(
        <FournisseurTheme>
          <Chip libelle="Perdre du poids" variante="selection" selectionne onPress={() => {}} />
        </FournisseurTheme>,
      );

      const chip = screen.getByRole('button', { name: 'Perdre du poids' });
      expect(chip.props.accessibilityState.selected).toBe(true);
    });
  });

  it('presser le corps du chip retirable appelle onPress, pas onRetirer', async () => {
    const onPress = jest.fn();
    const onRetirer = jest.fn();
    await render(
      <FournisseurTheme>
        <Chip
          libelle="Nouveau"
          variante="filtreRetirable"
          selectionne={false}
          onPress={onPress}
          onRetirer={onRetirer}
          accessibilityLabelRetirer="Retirer le filtre Nouveau"
        />
      </FournisseurTheme>,
    );

    await fireEvent.press(screen.getByText('Nouveau'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onRetirer).not.toHaveBeenCalled();
  });
});
