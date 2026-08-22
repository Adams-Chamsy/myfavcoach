import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { calculerDecalageEntreeModale, Modale } from './modale';

function rendreModale(ouverte: boolean, onFermer = () => {}) {
  return render(
    <FournisseurTheme>
      <Modale
        ouverte={ouverte}
        onFermer={onFermer}
        titre="Supprimer ce programme ?"
        corps="Cette action est definitive."
        libelleAction="Annuler"
        onAction={() => {}}
        libelleDestructeur="Supprimer"
        onDestructeur={() => {}}
        testID="modale"
      >
        <Text>Contenu ecran</Text>
      </Modale>
    </FournisseurTheme>,
  );
}

describe('Modale', () => {
  it('rend le titre, le corps et les deux actions', async () => {
    await rendreModale(true);

    expect(screen.getByText('Supprimer ce programme ?')).toBeTruthy();
    expect(screen.getByText('Cette action est definitive.')).toBeTruthy();
    expect(screen.getByText('Annuler')).toBeTruthy();
    expect(screen.getByText('Supprimer')).toBeTruthy();
  });

  it('masque le contenu de fond du lecteur d’ecran quand la modale est ouverte', async () => {
    await rendreModale(true);

    const arrierePlan = screen.getByText('Contenu ecran', { includeHiddenElements: true }).parent!;
    expect(arrierePlan.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(arrierePlan.props.accessibilityElementsHidden).toBe(true);
  });

  it('laisse le contenu de fond accessible quand la modale est fermee', async () => {
    await rendreModale(false);

    const arrierePlan = screen.getByText('Contenu ecran').parent!;
    expect(arrierePlan.props.importantForAccessibility).toBe('auto');
  });

  it('appelle onFermer quand le bouton retour Android est presse (onRequestClose)', async () => {
    const onFermer = jest.fn();
    await rendreModale(true, onFermer);

    screen.getByTestId('modale').props.onRequestClose();

    expect(onFermer).toHaveBeenCalledTimes(1);
  });

  it("ne rend pas le Modal quand la modale n'a jamais ete ouverte", async () => {
    await rendreModale(false);

    expect(screen.queryByTestId('modale')).toBeNull();
  });
});

describe('calculerDecalageEntreeModale', () => {
  it('vaut 0 quel que soit l’avancement de l’animation quand le mouvement reduit est actif', () => {
    expect(calculerDecalageEntreeModale(true, 0, 16)).toBe(0);
    expect(calculerDecalageEntreeModale(true, 0.5, 16)).toBe(0);
    expect(calculerDecalageEntreeModale(true, 1, 16)).toBe(0);
  });

  it('translate depuis le decalage maximal jusqu’a 0 quand le mouvement reduit est inactif', () => {
    expect(calculerDecalageEntreeModale(false, 0, 16)).toBe(16);
    expect(calculerDecalageEntreeModale(false, 1, 16)).toBe(0);
  });
});
