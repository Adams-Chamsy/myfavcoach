import { render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { taille, themes } from '@/theme/tokens';
import { Avatar, type TailleAvatar } from './avatar';

describe('Avatar', () => {
  it('rend les initiales du nom (repli, aucune photo fournie)', async () => {
    await render(
      <FournisseurTheme>
        <Avatar nom="Camille Dupré" />
      </FournisseurTheme>,
    );

    // Les initiales sont masquees du lecteur d'ecran (le libelle du conteneur porte deja
    // le nom complet) : includeHiddenElements pour verifier qu'elles sont bien rendues.
    expect(screen.getByText('CD', { includeHiddenElements: true })).toBeTruthy();
  });

  it("expose le nom comme nom accessible quand il n'y a pas de pastille", async () => {
    await render(
      <FournisseurTheme>
        <Avatar nom="Camille Dupré" />
      </FournisseurTheme>,
    );

    expect(screen.getByLabelText('Camille Dupré')).toBeTruthy();
  });

  it('fusionne le libelle de la pastille dans le nom accessible', async () => {
    await render(
      <FournisseurTheme>
        <Avatar
          nom="Camille Dupré"
          pastille={{ couleur: themes.clair.etat.succes, accessibilityLabel: 'en ligne' }}
        />
      </FournisseurTheme>,
    );

    expect(screen.getByLabelText('Camille Dupré, en ligne')).toBeTruthy();
  });

  const TAILLES: [TailleAvatar, number][] = [
    ['xs', taille.avatarXs],
    ['sm', taille.avatarSm],
    ['md', taille.avatarMd],
    ['lg', taille.avatarLg],
    ['xl', taille.avatarXl],
  ];

  it.each(TAILLES)(
    'taille %s utilise le token taille.avatar* (%dpt)',
    async (tailleAvatar, dimension) => {
      await render(
        <FournisseurTheme>
          <Avatar nom="Camille Dupré" taille={tailleAvatar} />
        </FournisseurTheme>,
      );

      const conteneur = screen.getByLabelText('Camille Dupré');
      expect(conteneur.props.style.width).toBe(dimension);
      expect(conteneur.props.style.height).toBe(dimension);
    },
  );
});
