import { Pressable, View } from 'react-native';

import { Avatar } from '@/composants/avatar';
import { useTheme } from '@/theme/fournisseur';

import { EntetePublicV2, FournisseurPresentationV2 } from '@/composants/presentation-v2';
import { useDispositionEcran } from '@/composants/canevas-ecran';

/** L’avatar reste disponible au-dessus des états du coach. Sur web large, il est dans la navigation. */
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
  const { large } = useDispositionEcran();
  if (large) return null;
  return (
    <FournisseurPresentationV2>
      <View accessibilityLabel={titre}>
        <EntetePublicV2
          accessoire={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ouvrir la bascule d'espace"
              onPress={onOuvrirBascule}
              style={{
                minWidth: theme.taille.tapMin,
                minHeight: theme.taille.tapMin,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Avatar nom={nomAvatar} taille="sm" />
            </Pressable>
          }
        />
      </View>
    </FournisseurPresentationV2>
  );
}
