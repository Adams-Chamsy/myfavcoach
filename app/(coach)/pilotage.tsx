import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/composants/avatar';
import { EcranProvisoire } from '@/composants/ecran-provisoire';
import { useDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FeuilleBascule } from '@/fonctionnalites/identite/feuille-bascule';
import { useTheme } from '@/theme/fournisseur';

// Écran 08, docs/perimetre.md. PROVISOIRE au-delà de l'avatar : le reste de l'écran (pilotage
// réel) est L7, hors périmètre de ce lot. L'avatar est ajouté ici par P1.12 (docs/prompts/L1.md)
// — seul point de cet écran que L1-06 (bascule d'espace) doit poser avant que l'écran réel
// n'existe.
export default function Pilotage() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profils } = useDonnees();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  const nom = profils
    ? [profils.identiteActive.prenom, profils.identiteActive.nom].filter(Boolean).join(' ')
    : '';

  return (
    <FeuilleBascule ouverte={feuilleOuverte} onFermer={() => setFeuilleOuverte(false)}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingTop: insets.top + theme.espace[2],
            paddingHorizontal: theme.espace.gouttiere,
            paddingBottom: theme.espace[2],
          }}
        >
          <Pressable
            onPress={() => setFeuilleOuverte(true)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la bascule d'espace"
          >
            <Avatar nom={nom} taille="md" />
          </Pressable>
        </View>

        <EcranProvisoire titre="Pilotage" lot="L7" />
      </View>
    </FeuilleBascule>
  );
}
