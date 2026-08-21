import { render, screen } from '@testing-library/react-native';

import { FournisseurTheme } from '@/theme/fournisseur';
import { Badge, type StatutBadge } from './badge';

const STATUTS: StatutBadge[] = ['succes', 'alerte', 'erreur', 'neutre', 'accent'];

describe('Badge', () => {
  it.each(STATUTS)('rend le statut %s avec son libelle', async (statut) => {
    await render(
      <FournisseurTheme>
        <Badge statut={statut} libelle="À jour" />
      </FournisseurTheme>,
    );

    expect(screen.getByText('À jour')).toBeTruthy();
  });

  // Jamais execute : ce test existe pour son erreur de compilation, verifiee par
  // `npm run typecheck`, pas par jest.
  it.skip('sans libelle ne compile pas', () => {
    // @ts-expect-error libelle est obligatoire dans ProprietesBadge
    void (<Badge statut="succes" />);
  });
});
