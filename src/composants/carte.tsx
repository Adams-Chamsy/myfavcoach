import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/fournisseur';

export type ProprietesCarte = { children: ReactNode };

/** Une surface délimitée, sans ombre systématique : le contenu porte la hiérarchie. */
export function Carte({ children }: ProprietesCarte) {
  const theme = useTheme();
  return (
    <View
      style={{
        borderRadius: theme.rayon.carte,
        backgroundColor: theme.couleur.fond.surface,
        borderWidth: theme.taille.bordureFine,
        borderColor: theme.couleur.bordure.discrete,
      }}
    >
      {children}
    </View>
  );
}
