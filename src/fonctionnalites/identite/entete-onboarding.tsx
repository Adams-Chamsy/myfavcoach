import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoutonIcone } from '@/composants/bouton-icone';
import { Progression, type EtatSegment } from '@/composants/progression';
import { useTheme } from '@/theme/fournisseur';
import { font } from '@/theme/tokens';

const NOMBRE_ETAPES = 4;

// En-tête partagé des quatre écrans d'onboarding (docs/ecrans/L1-05-onboarding-client.md,
// "Élément commun aux quatre étapes") : bouton retour, fil de segments, lien "Passer".
// Fixe (ne défile pas), comme le pied fixe — la maquette (écran 22) le montre en dehors de la
// zone `overflow:hidden` du contenu, jamais dans le flux du ScrollView.
export type ProprietesEnteteOnboarding = {
  etape: 1 | 2 | 3 | 4;
  // Absent à l'étape 1 uniquement (fiche : "« Passer » n'apparaît pas à l'étape 1", le prénom
  // étant la seule donnée obligatoire de tout l'onboarding) — sa présence pilote directement
  // l'affichage du lien, jamais un booléen séparé qu'un écran pourrait oublier de synchroniser.
  onPasser?: () => void;
  // Pendant l'enregistrement d'une étape (docs/ecrans/L1-05, États : "Chargement") : retour et
  // "Passer" désactivés, pour ne pas quitter l'écran pendant qu'une écriture est en vol.
  desactive?: boolean;
};

function segments(etape: number): EtatSegment[] {
  return Array.from({ length: NOMBRE_ETAPES }, (_, index) => {
    const numero = index + 1;
    if (numero < etape) return 'atteint';
    if (numero === etape) return 'actuel';
    return 'reste';
  });
}

export function EnteteOnboarding({
  etape,
  onPasser,
  desactive = false,
}: ProprietesEnteteOnboarding) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.espace[3],
        paddingTop: insets.top + theme.espace[2],
        paddingHorizontal: theme.espace.gouttiere,
        paddingBottom: theme.espace[3],
      }}
    >
      <BoutonIcone
        nom="retour"
        accessibilityLabel="Retour"
        onPress={() => router.back()}
        desactive={desactive}
      />

      <View style={{ flex: 1 }}>
        <Progression
          variante="segments"
          segments={segments(etape)}
          accessibilityLabel={`Étape ${etape} sur ${NOMBRE_ETAPES}`}
        />
      </View>

      {onPasser ? (
        <Pressable
          onPress={onPasser}
          disabled={desactive}
          accessibilityRole="button"
          style={{ minHeight: theme.taille.tapMin, justifyContent: 'center' }}
        >
          <Text
            style={{
              ...theme.texte.petit,
              fontFamily: font.uiBold,
              color: theme.couleur.texte.attenue,
            }}
          >
            Passer
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
