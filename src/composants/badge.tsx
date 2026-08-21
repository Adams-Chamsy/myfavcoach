import { Text, View } from 'react-native';

import { useTheme, type ThemeResolu } from '@/theme/fournisseur';
import { weight } from '@/theme/tokens';

export type StatutBadge = 'succes' | 'alerte' | 'erreur' | 'neutre' | 'accent';

export type ProprietesBadge = {
  statut: StatutBadge;
  // Pas de "?" : un statut porte par la seule couleur est interdit
  // (docs/design-system.md §2), le composant ne compile pas sans libelle.
  libelle: string;
};

function couleursStatut(theme: ThemeResolu, statut: StatutBadge) {
  const { couleur } = theme;
  switch (statut) {
    case 'succes':
      return { fond: couleur.etat.succesTeinte, texte: couleur.etat.succesEncre };
    case 'alerte':
      return { fond: couleur.etat.alerteTeinte, texte: couleur.etat.alerteEncre };
    case 'erreur':
      return { fond: couleur.etat.erreurTeinte, texte: couleur.etat.erreurEncre };
    case 'accent':
      return { fond: couleur.marque.accentTeinte, texte: couleur.marque.accentTeinteEncre };
    case 'neutre':
      return { fond: couleur.gris[200], texte: couleur.texte.secondaire };
  }
}

export function Badge({ statut, libelle }: ProprietesBadge) {
  const theme = useTheme();
  const { fond, texte } = couleursStatut(theme, statut);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: theme.espace[2],
        paddingHorizontal: theme.espace[3],
        borderRadius: theme.rayon.badge,
        backgroundColor: fond,
      }}
    >
      <Text style={{ ...theme.texte.legende, fontWeight: weight.bold, color: texte }}>
        {libelle}
      </Text>
    </View>
  );
}
