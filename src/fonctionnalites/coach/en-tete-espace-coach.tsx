import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

// L'en-tête de l'espace coach (écran 08, pilotage) : île sombre fixe, avec l'avatar qui ouvre la
// feuille de bascule (docs/ecrans/L1-06-bascule-espace.md, première entrée).
//
// UN SEUL en-tête, rendu par le pilotage AU-DESSUS de ses quatre états (chargement, attente de
// vérification, premier lancement, pilotage). Trouvé sur iPhone le 2 novembre 2026 : depuis le
// 12 septembre (L2), l'avatar n'existait que dans l'un des quatre ; un coach non vérifié ne
// pouvait ni revenir à l'espace client, ni atteindre l'écran compte (déconnexion, suppression du
// compte). Les sous-écrans (attente, premier lancement) ne dessinent plus leur propre en-tête :
// une sortie qui vit dans une branche disparaît avec elle.
//
// Île fixe, toujours sombre (CLAUDE.md §5) : themes.sombre lu explicitement.
export function EnTeteEspaceCoach({
  titre,
  nomAvatar,
  onOuvrirBascule,
}: {
  titre: string;
  nomAvatar: string;
  onOuvrirBascule: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: themes.sombre.fond.canevas,
        paddingTop: insets.top + theme.espace[3],
        paddingHorizontal: theme.espace.gouttiere,
        paddingBottom: theme.espace[4],
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[3],
      }}
    >
      <Pressable
        onPress={onOuvrirBascule}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir la bascule d'espace"
        hitSlop={theme.espace[2]}
      >
        <Avatar nom={nomAvatar} taille="md" />
      </Pressable>
      <Text style={{ ...theme.texte.titre2, color: themes.sombre.texte.surSombre }}>{titre}</Text>
    </View>
  );
}
