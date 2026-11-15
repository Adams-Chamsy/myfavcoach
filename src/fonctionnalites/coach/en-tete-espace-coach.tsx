import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { Marque } from '@/composants/marque';
import { useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';

/** L’avatar reste au-dessus de tous les états : le changement d’espace est toujours possible. */
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
        backgroundColor: themes.clair.fond.canevas,
        paddingTop: insets.top + theme.espace[3],
        paddingHorizontal: theme.espace.gouttiere,
        paddingBottom: theme.espace[4],
        gap: theme.espace[3],
        borderBottomWidth: theme.taille.bordureFine,
        borderBottomColor: themes.clair.bordure.discrete,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.espace[4],
        }}
      >
        <Marque surFondClair />
        <Pressable
          onPress={onOuvrirBascule}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir la bascule d'espace"
          style={{
            minWidth: theme.taille.tapMin,
            minHeight: theme.taille.tapMin,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Avatar nom={nomAvatar} taille="md" />
        </Pressable>
      </View>
      <Text style={{ ...theme.texte.petit, color: themes.clair.texte.secondaire }}>{titre}</Text>
    </View>
  );
}
