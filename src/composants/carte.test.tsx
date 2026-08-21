import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { rayon } from '@/theme/tokens';
import { Carte } from './carte';

describe('Carte', () => {
  it('rend son contenu', async () => {
    await render(
      <FournisseurTheme>
        <Carte>
          <Text>Nadia Belkacem</Text>
        </Carte>
      </FournisseurTheme>,
    );

    expect(screen.getByText('Nadia Belkacem')).toBeTruthy();
  });

  it('utilise rayon.carte et ne fixe aucune hauteur', async () => {
    await render(
      <FournisseurTheme>
        <Carte>
          <Text>Contenu</Text>
        </Carte>
      </FournisseurTheme>,
    );

    const carte = screen.getByText('Contenu').parent!;
    expect(carte.props.style.borderRadius).toBe(rayon.carte);
    expect(carte.props.style.height).toBeUndefined();
  });
});
