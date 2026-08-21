import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/fournisseur';
import type { StyleOmbre } from '@/theme/types';

export type ProprietesCarte = {
  children: ReactNode;
};

// Convertit un token d'ombre (couleur+opacite combinees en rgba) vers les proprietes
// d'ombre React Native, qui les veut separees. "spread" n'a pas d'equivalent RN, ignore.
function styleOmbre(ombre: StyleOmbre) {
  const composantes = ombre.color.match(/[\d.]+/g);
  const [r, g, b, a] = (composantes ?? ['0', '0', '0', '1']).map(Number);
  return {
    shadowColor: `rgb(${r}, ${g}, ${b})`,
    shadowOpacity: a,
    shadowOffset: { width: ombre.x, height: ombre.y },
    shadowRadius: ombre.blur,
    elevation: Math.round(ombre.blur / 2),
  };
}

export function Carte({ children }: ProprietesCarte) {
  const theme = useTheme();

  return (
    <View
      style={{
        borderRadius: theme.rayon.carte,
        backgroundColor: theme.couleur.fond.surface,
        // Aucune hauteur fixe : la carte s'etire selon son contenu.
        ...styleOmbre(theme.ombre[1]),
      }}
    >
      {children}
    </View>
  );
}
