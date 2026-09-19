import { Pressable, Text, View } from 'react-native';

import { Carte } from '@/composants/carte';
import { Icone } from '@/composants/icones';
import { useTheme } from '@/theme/fournisseur';

// Point d'entrée L3bis (docs/ecrans/L3bis-I01-inviter-mes-clients.md, Règles) : I-01 n'a pas de
// route naturelle avant L7 ("Clients" reste EcranProvisoire à ce lot) — cette carte est le seul
// chemin qui rend l'écran atteignable depuis app/(coach)/(tabs)/pilotage.tsx, retirée le jour où
// L7 offre un meilleur point d'entrée. Extraite en composant, même motif que
// AttenteVerification/PremierLancement du même dossier : la galerie l'exerce directement, sans
// devoir rejouer tout le montage de Pilotage (dossier vérifié, offre publiée) pour l'atteindre.
export function CarteImporterClients({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <View style={{ paddingHorizontal: theme.espace.gouttiere, paddingBottom: theme.espace[4] }}>
      <Carte>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Importer mes clients"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.espace[3],
            paddingHorizontal: theme.espace[4],
            paddingVertical: theme.espace[4],
            minHeight: theme.taille.tapMin,
          }}
        >
          <Icone nom="clients" couleur={theme.couleur.texte.secondaire} />
          <Text style={{ ...theme.texte.corps, flex: 1, color: theme.couleur.texte.principal }}>
            Importer mes clients
          </Text>
          <Icone nom="suivant" couleur={theme.couleur.texte.attenue} />
        </Pressable>
      </Carte>
    </View>
  );
}
