import { Text, View } from 'react-native';

import { useTheme } from '@/theme/fournisseur';
import type { TexteRefus } from './textes';

// Un refus du serveur, ou l'absence de réponse : titre et détail, annoncés au lecteur d'écran.
export function BandeauRefus({ refus }: { refus: TexteRefus }) {
  const theme = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: theme.espace[1] }}>
      <Text style={{ ...theme.texte.label, color: theme.couleur.etat.erreurEncre }}>
        {refus.titre}
      </Text>
      <Text style={{ ...theme.texte.petit, color: theme.couleur.etat.erreurEncre }}>
        {refus.detail}
      </Text>
    </View>
  );
}
