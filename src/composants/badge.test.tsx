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
});

// Le cas "sans libellé ne compile pas" vit dans badge.compilation.tsx, pas ici : une erreur de
// compilation ne s'exécute jamais, donc jamais dans Jest — voir ce fichier pour le pourquoi.
