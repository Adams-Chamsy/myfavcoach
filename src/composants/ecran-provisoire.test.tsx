import { render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { EcranProvisoire } from './ecran-provisoire';

describe('EcranProvisoire', () => {
  it('affiche le titre et le lot qui apportera l’écran', async () => {
    await render(
      <FournisseurTheme>
        <EcranProvisoire titre="Accueil" lot="L3" />
      </FournisseurTheme>,
    );

    expect(screen.getByText('Accueil')).toBeTruthy();
    expect(screen.getByText('Lot L3')).toBeTruthy();
  });
});
