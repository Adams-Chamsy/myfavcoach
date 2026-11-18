import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CanevasEcran, DefilementEcran } from '@/composants/canevas-ecran';
import { useTheme } from '@/theme/fournisseur';
import { CarteSeanceDuJour } from './carte-seance-du-jour';

// L'onglet « Séance » du client (écran 05, docs/ecrans/L6-05-seance-du-jour.md) : la séance du
// jour, ou une phrase quand il n'y en a pas. Resté « Lot L6 » à la porte de L6 : trouvé à
// l'ouverture de L7, le 18 novembre 2026.
export function EcranOngletSeance({ onOuvrir }: { onOuvrir: (id: string) => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <CanevasEcran style={{ flex: 1, backgroundColor: theme.couleur.fond.canevas }}>
      <DefilementEcran
        contentContainerStyle={{
          paddingTop: insets.top + theme.espace[4],
          paddingHorizontal: theme.espace.gouttiere,
          paddingBottom: theme.espace[8],
          gap: theme.espace[4],
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ ...theme.texte.titre1, color: theme.couleur.texte.principal }}
        >
          Séance
        </Text>
        <CarteSeanceDuJour
          onOuvrir={onOuvrir}
          siAucune={
            <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
              Aucune séance prévue aujourd’hui.
            </Text>
          }
        />
      </DefilementEcran>
    </CanevasEcran>
  );
}
