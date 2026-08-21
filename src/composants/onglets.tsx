import { useRef } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/fournisseur';
import { mouvement, weight } from '@/theme/tokens';

export type OptionOnglet<Valeur extends string> = {
  valeur: Valeur;
  libelle: string;
};

export type ProprietesOnglets<Valeur extends string> = {
  options: OptionOnglet<Valeur>[];
  valeurActive: Valeur;
  onChangement: (valeur: Valeur) => void;
};

function courbeVersEasing(courbe: string) {
  const nombres = courbe.match(/-?\d*\.?\d+/g);
  const [x1, y1, x2, y2] = (nombres ?? ['0', '0', '1', '1']).map(Number);
  return Easing.bezier(x1, y1, x2, y2);
}

export function Onglets<Valeur extends string>({
  options,
  valeurActive,
  onChangement,
}: ProprietesOnglets<Valeur>) {
  const theme = useTheme();
  const mesures = useRef<Partial<Record<Valeur, { x: number; largeur: number }>>>({}).current;
  const indicateurX = useSharedValue(0);
  const indicateurLargeur = useSharedValue(0);

  function animerIndicateurVers(mesure: { x: number; largeur: number }) {
    const optionsAnimation = {
      duration: mouvement.entree,
      easing: courbeVersEasing(mouvement.courbe),
    };
    indicateurX.value = withTiming(mesure.x, optionsAnimation);
    indicateurLargeur.value = withTiming(mesure.largeur, optionsAnimation);
  }

  function surLayout(valeur: Valeur, evenement: LayoutChangeEvent) {
    const { x, width } = evenement.nativeEvent.layout;
    mesures[valeur] = { x, largeur: width };
    if (valeur === valeurActive && indicateurLargeur.value === 0) {
      // Pose initiale sans animation : uniquement quand l'indicateur n'a jamais ete place.
      indicateurX.value = x;
      indicateurLargeur.value = width;
    }
  }

  function surChangement(valeur: Valeur) {
    onChangement(valeur);
    const mesure = mesures[valeur];
    if (mesure) {
      animerIndicateurVers(mesure);
    }
  }

  const styleIndicateur = useAnimatedStyle(() => ({
    left: indicateurX.value,
    width: indicateurLargeur.value,
  }));

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.couleur.fond.creux,
        borderRadius: theme.rayon.pilule,
        padding: theme.espace[1],
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: theme.espace[1],
            bottom: theme.espace[1],
            borderRadius: theme.rayon.pilule,
            backgroundColor: theme.couleur.fond.surface,
          },
          styleIndicateur,
        ]}
      />
      {options.map((option) => {
        const estActif = option.valeur === valeurActive;
        return (
          <Pressable
            key={option.valeur}
            onLayout={(evenement) => surLayout(option.valeur, evenement)}
            onPress={() => surChangement(option.valeur)}
            accessibilityRole="tab"
            accessibilityState={{ selected: estActif }}
            style={{
              flex: 1,
              minHeight: theme.taille.tapMin,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                ...theme.texte.petit,
                fontWeight: estActif ? weight.bold : weight.semibold,
                color: estActif ? theme.couleur.texte.principal : theme.couleur.texte.secondaire,
              }}
            >
              {option.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
