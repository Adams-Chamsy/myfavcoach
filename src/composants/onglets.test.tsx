import { fireEvent, render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { taille } from '@/theme/tokens';
import { Onglets } from './onglets';

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
});
