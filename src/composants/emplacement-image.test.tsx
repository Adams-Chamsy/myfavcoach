import { render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { EmplacementImage, type RatioEmplacementImage } from './emplacement-image';

describe('EmplacementImage', () => {
  it("sans source, rend le repli en initiales (aucune photo n'est fournie)", async () => {
    await render(
      <FournisseurTheme>
        <EmplacementImage nom="Nadia Belkacem" ratio="portrait3x4" />
      </FournisseurTheme>,
    );

    // Les initiales sont masquees du lecteur d'ecran (le conteneur porte deja le nom
    // complet) : includeHiddenElements pour verifier qu'elles sont bien rendues.
    expect(screen.getByText('NB', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Nadia Belkacem')).toBeTruthy();
  });

  it('ne rend jamais une zone vide meme sans source ni nom exploitable', async () => {
    await render(
      <FournisseurTheme>
        <EmplacementImage nom="X" ratio="paysage4x3" />
      </FournisseurTheme>,
    );

    expect(screen.getByText('X', { includeHiddenElements: true })).toBeTruthy();
  });

  it('avec une source, rend une image plutot que le repli', async () => {
    await render(
      <FournisseurTheme>
        <EmplacementImage
          nom="Nadia Belkacem"
          ratio="portrait3x4"
          source="https://exemple.test/photo.jpg"
        />
      </FournisseurTheme>,
    );

    expect(screen.queryByText('NB', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText('Nadia Belkacem')).toBeTruthy();
  });

  const RATIOS: RatioEmplacementImage[] = ['portrait3x4', 'paysage4x3', 'pleinCadre'];

  it.each(RATIOS)('rend sans erreur avec le ratio %s', async (ratio) => {
    await render(
      <FournisseurTheme>
        <EmplacementImage nom="Nadia Belkacem" ratio={ratio} />
      </FournisseurTheme>,
    );

    expect(screen.getByLabelText('Nadia Belkacem')).toBeTruthy();
  });

  it('pleinCadre fixe une hauteur, les autres ratios fixent aspectRatio', async () => {
    await render(
      <FournisseurTheme>
        <EmplacementImage nom="Nadia Belkacem" ratio="pleinCadre" />
      </FournisseurTheme>,
    );
    const pleinCadre = screen.getByLabelText('Nadia Belkacem');
    expect(pleinCadre.props.style.height).toBe(400);
    expect(pleinCadre.props.style.aspectRatio).toBeUndefined();

    await render(
      <FournisseurTheme>
        <EmplacementImage nom="Nadia Belkacem" ratio="portrait3x4" />
      </FournisseurTheme>,
    );
    const portrait = screen.getAllByLabelText('Nadia Belkacem').at(-1)!;
    expect(portrait.props.style.aspectRatio).toBeCloseTo(3 / 4);
    expect(portrait.props.style.height).toBeUndefined();
  });

  // docs/ecrans/L1-01-bienvenue.md : le fond plein écran a besoin de remplir l'espace flex
  // disponible, pas une hauteur fixe — sans changer le comportement par défaut ci-dessus.
  it('pleinCadre avec remplir bascule sur flex:1 au lieu de la hauteur fixe', async () => {
    await render(
      <FournisseurTheme>
        <EmplacementImage nom="Accueil" ratio="pleinCadre" remplir />
      </FournisseurTheme>,
    );
    const rempli = screen.getByLabelText('Accueil');
    expect(rempli.props.style.flex).toBe(1);
    expect(rempli.props.style.height).toBeUndefined();
  });
});
