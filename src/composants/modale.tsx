import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Bouton } from '@/composants/bouton';
import { useMouvementReduit, useTheme } from '@/theme/fournisseur';

export type ProprietesModale = {
  ouverte: boolean;
  onFermer: () => void;
  titre: string;
  corps: string;
  libelleAction: string;
  onAction: () => void;
  libelleDestructeur: string;
  onDestructeur: () => void;
  // Contenu d'ecran normal, derriere la modale : masque du lecteur d'ecran tant que la
  // modale est montee (piege de focus, meme mecanisme que FeuilleBasse).
  children: ReactNode;
  testID?: string;
};

function courbeVersEasing(courbe: string) {
  const nombres = courbe.match(/-?\d*\.?\d+/g);
  const [x1, y1, x2, y2] = (nombres ?? ['0', '0', '1', '1']).map(Number);
  return Easing.bezier(x1, y1, x2, y2);
}

// Extrait de useAnimatedStyle pour rester testable directement, meme raison que
// calculerDecalageEntree dans src/composants/feuille-basse.tsx.
export function calculerDecalageEntreeModale(
  mouvementReduitActif: boolean,
  progression: number,
  decalageMax: number,
) {
  'worklet';
  if (mouvementReduitActif) return 0;
  return (1 - progression) * decalageMax;
}

// Pas de fermeture au tap sur le voile, contrairement a FeuilleBasse : une modale porte
// generalement une action destructrice, la fermer par accident serait dangereux.
export function Modale({
  ouverte,
  onFermer,
  titre,
  corps,
  libelleAction,
  onAction,
  libelleDestructeur,
  onDestructeur,
  children,
  testID,
}: ProprietesModale) {
  const theme = useTheme();
  const {
    actif: mouvementReduitActif,
    entree: dureeEntree,
    voile: dureeVoile,
    voileOpacite,
    courbe,
  } = useMouvementReduit();

  const [estMonte, setEstMonte] = useState(ouverte);
  const opaciteVoile = useSharedValue(0);
  const progression = useSharedValue(0);

  if (ouverte && !estMonte) {
    setEstMonte(true);
  }

  useEffect(() => {
    const easing = courbeVersEasing(courbe);
    opaciteVoile.value = withTiming(ouverte ? 1 : 0, { duration: dureeVoile, easing });
    progression.value = withTiming(
      ouverte ? 1 : 0,
      { duration: dureeEntree, easing },
      (termine) => {
        if (termine && !ouverte) {
          runOnJS(setEstMonte)(false);
        }
      },
    );
    // opaciteVoile/progression sont des SharedValue Reanimated, stables entre les rendus :
    // pas necessaire aux deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte, dureeVoile, dureeEntree, courbe]);

  const styleVoile = useAnimatedStyle(() => ({ opacity: opaciteVoile.value * voileOpacite }));

  const styleModale = useAnimatedStyle(() => {
    const decalageEntree = calculerDecalageEntreeModale(
      mouvementReduitActif,
      progression.value,
      theme.espace[4],
    );
    return {
      opacity: progression.value,
      transform: [{ translateY: decalageEntree }],
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
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: theme.espace[6],
            }}
          >
            <Animated.View
              style={[{ ...styleAbsolu, backgroundColor: theme.couleur.fond.inverse }, styleVoile]}
            />

            <Animated.View
              style={[
                {
                  width: '100%',
                  borderRadius: theme.rayon.panneau,
                  backgroundColor: theme.couleur.fond.surface,
                  padding: theme.espace[6],
                  gap: theme.espace[4],
                },
                styleModale,
              ]}
            >
              <Text style={{ ...theme.texte.titre2, color: theme.couleur.texte.principal }}>
                {titre}
              </Text>
              <Text style={{ ...theme.texte.corps, color: theme.couleur.texte.secondaire }}>
                {corps}
              </Text>
              <View
                style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.espace[2] }}
              >
                <Bouton variante="secondaire" libelle={libelleAction} onPress={onAction} />
                <Bouton
                  variante="destructeur"
                  libelle={libelleDestructeur}
                  onPress={onDestructeur}
                />
              </View>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styleAbsolu = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
