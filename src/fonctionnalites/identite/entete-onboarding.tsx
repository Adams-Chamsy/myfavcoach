import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoutonIcone } from '@/composants/bouton-icone';
import { Progression, type EtatSegment } from '@/composants/progression';
import { useTheme } from '@/theme/fournisseur';
import { font } from '@/theme/tokens';

const NOMBRE_ETAPES = 4;

// En-tête partagé des parcours en quatre étapes : l'onboarding client (les quatre écrans de
// docs/ecrans/L1-05-onboarding-client.md, "Élément commun aux quatre étapes") ET l'activation
// de l'espace coach (docs/ecrans/L1-08-activation-espace-coach.md — étape 1/4 ici, étapes 2 à 4
// au lot L2). Bouton retour, fil de segments, et lien "Passer" quand `onPasser` est fourni
// (jamais côté coach : l'activation n'est pas une étape qu'on saute). Fixe (ne défile pas),
// comme le pied fixe — la maquette de l'onboarding client (écran 22) le montre en dehors de la
// zone `overflow:hidden` du contenu, jamais dans le flux du ScrollView.
export type ProprietesEnteteOnboarding = {
  etape: 1 | 2 | 3 | 4;
  // Absent quand l'étape ne se saute pas : l'étape 1 de l'onboarding client (fiche L1-05 :
  // "« Passer » n'apparaît pas à l'étape 1", le prénom étant la seule donnée obligatoire de
  // tout l'onboarding) et toute l'activation coach (L1-08). Sa présence pilote directement
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

  // docs/ecrans/L1-05, "Élément commun" : jamais affiché quand il n'y a rien derrière l'écran
  // courant — l'entrée dans l'onboarding REMPLACE la route (app/index.tsx, determinerDestination),
  // jamais ne l'empile, donc "rien derrière" peut arriver à n'importe quelle étape selon la
  // reprise (onboarding_etape déjà avancé), pas seulement à l'étape 1. Un bouton visible mais
  // inerte serait une promesse trompeuse — router.canGoBack() décide à l'exécution, jamais une
  // règle fixe par numéro d'étape. Trouvé après coup (P1.11) : affiché sans condition, il
  // plantait ("GO_BACK non géré") dès qu'on le pressait sur l'écran d'entrée d'une session —
  // voir src/test/routage/profondeur-pile-entree-onboarding.test.tsx.
  const peutRevenir = router.canGoBack();

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
      {peutRevenir ? (
        <BoutonIcone
          nom="retour"
          accessibilityLabel="Retour"
          onPress={() => router.back()}
          desactive={desactive}
        />
      ) : null}

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
