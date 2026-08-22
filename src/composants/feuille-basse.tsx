import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Modal, PanResponder, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useMouvementReduit, useTheme } from '@/theme/fournisseur';

export type ProprietesFeuilleBasse = {
  ouverte: boolean;
  onFermer: () => void;
  // Contenu de la feuille elle-meme.
  enfants: ReactNode;
  // Contenu d'ecran normal, derriere la feuille : masque du lecteur d'ecran tant que la
  // feuille est montee (piege de focus, docs/design-system.md §4).
  children: ReactNode;
  testID?: string;
};

function courbeVersEasing(courbe: string) {
  const nombres = courbe.match(/-?\d*\.?\d+/g);
  const [x1, y1, x2, y2] = (nombres ?? ['0', '0', '1', '1']).map(Number);
  return Easing.bezier(x1, y1, x2, y2);
}

// docs/design-system.md §4 : "fermeture au glissement a partir de 25 % de la hauteur".
const SEUIL_FERMETURE_GLISSEMENT = 0.25;

// Extrait de useAnimatedStyle pour rester testable directement (une SharedValue mutee
// n'entraine aucun nouveau rendu React, donc aucune fonction utilisant Reanimated n'est
// observable via les props d'un composant rendu dans un test). "worklet" est necessaire :
// cette fonction est appelee depuis un contexte worklet (voir styleFeuille plus bas).
export function calculerDecalageEntree(
  mouvementReduitActif: boolean,
  progression: number,
  hauteur: number,
) {
  'worklet';
  // En mouvement reduit : aucune translation, seule l'opacite anime (docs/design-system.md §4).
  if (mouvementReduitActif) return 0;
  return (1 - progression) * hauteur;
}

export function FeuilleBasse({
  ouverte,
  onFermer,
  enfants,
  children,
  testID,
}: ProprietesFeuilleBasse) {
  const theme = useTheme();
  const {
    actif: mouvementReduitActif,
    feuille: dureeFeuille,
    voile: dureeVoile,
    voileOpacite,
    courbe,
  } = useMouvementReduit();

  // Reste monte pendant l'animation de fermeture : sans ca, le Modal disparaitrait
  // instantanement et l'animation de sortie ne se verrait jamais.
  const [estMonte, setEstMonte] = useState(ouverte);
  const opaciteVoile = useSharedValue(0);
  const progressionFeuille = useSharedValue(0);
  const glissement = useSharedValue(0);
  const hauteurFeuille = useSharedValue(0);

  // Ajustement d'etat pendant le rendu (pattern recommande par React) plutot que dans
  // l'effet ci-dessous : evite un rendu en cascade pour rendre "estMonte" immediatement
  // vrai des que "ouverte" le devient.
  if (ouverte && !estMonte) {
    setEstMonte(true);
  }

  useEffect(() => {
    const easing = courbeVersEasing(courbe);
    opaciteVoile.value = withTiming(ouverte ? 1 : 0, { duration: dureeVoile, easing });
    if (!ouverte) glissement.value = 0;
    progressionFeuille.value = withTiming(
      ouverte ? 1 : 0,
      { duration: dureeFeuille, easing },
      (termine) => {
        if (termine && !ouverte) {
          runOnJS(setEstMonte)(false);
        }
      },
    );
    // opaciteVoile/progressionFeuille/glissement sont des SharedValue Reanimated, stables
    // entre les rendus : pas necessaire aux deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte, dureeVoile, dureeFeuille, courbe]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, geste) => geste.dy > 4,
        onPanResponderMove: (_, geste) => {
          if (geste.dy > 0) {
            // eslint-disable-next-line react-hooks/immutability -- mutation prevue par l'API SharedValue de Reanimated
            glissement.value = geste.dy;
          }
        },
        onPanResponderRelease: (_, geste) => {
          if (geste.dy > hauteurFeuille.value * SEUIL_FERMETURE_GLISSEMENT) {
            onFermer();
          } else {
            // eslint-disable-next-line react-hooks/immutability -- mutation prevue par l'API SharedValue de Reanimated
            glissement.value = withTiming(0, {
              duration: dureeFeuille,
              easing: courbeVersEasing(courbe),
            });
          }
        },
      }),
    [dureeFeuille, courbe, onFermer, glissement, hauteurFeuille],
  );

  const styleVoile = useAnimatedStyle(() => ({
    opacity: opaciteVoile.value * voileOpacite,
  }));

  const styleFeuille = useAnimatedStyle(() => {
    const decalageEntree = calculerDecalageEntree(
      mouvementReduitActif,
      progressionFeuille.value,
      hauteurFeuille.value,
    );
    return {
      opacity: progressionFeuille.value,
      transform: [{ translateY: decalageEntree + glissement.value }],
    };
  });

  return (
    <>
      <View
        accessibilityElementsHidden={estMonte}
        importantForAccessibility={estMonte ? 'no-hide-descendants' : 'auto'}
        style={{ flex: 1 }}
      >
        {children}
      </View>

      {estMonte ? (
        <Modal
          testID={testID}
          transparent
          visible
          animationType="none"
          onRequestClose={onFermer}
          statusBarTranslucent
        >
          <View style={{ flex: 1 }}>
            <Pressable
              onPress={onFermer}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={styleAbsolu}
            >
              <Animated.View
                style={[styleAbsolu, { backgroundColor: theme.couleur.fond.inverse }, styleVoile]}
              />
            </Pressable>

            <Animated.View
              testID={testID ? `${testID}-feuille` : undefined}
              onLayout={(evenement) => {
                // eslint-disable-next-line react-hooks/immutability -- mutation prevue par l'API SharedValue de Reanimated
                hauteurFeuille.value = evenement.nativeEvent.layout.height;
              }}
              {...panResponder.panHandlers}
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderTopLeftRadius: theme.rayon.feuille,
                  borderTopRightRadius: theme.rayon.feuille,
                  backgroundColor: theme.couleur.fond.surface,
                  padding: theme.espace[6],
                },
                styleFeuille,
              ]}
            >
              {enfants}
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styleAbsolu = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
