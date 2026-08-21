import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMouvementReduit, useTheme, type ThemeResolu } from '@/theme/fournisseur';

export type FormeSquelette = 'liste' | 'carte' | 'detail' | 'ligne';

export type ProprietesSquelette = {
  forme: FormeSquelette;
  testID?: string;
};

// docs/design-system.md §6 : "Pulsation d'opacite 1200 ms". design/tokens.json ne tokenise
// aucune duree de pulsation (le plus proche, mouvement.valeur, vaut 600 et sert a autre
// chose) : constante locale documentee plutot qu'un ajout muet. Voir docs/dette.md.
const DUREE_PULSATION = 1200;
const OPACITE_BASSE = 0.55;

function Bloc({
  largeur,
  hauteur,
  theme,
}: {
  largeur: number | `${number}%`;
  hauteur: number;
  theme: ThemeResolu;
}) {
  return (
    <View
      style={{
        width: largeur,
        height: hauteur,
        borderRadius: theme.rayon.champ,
        backgroundColor: theme.couleur.gris[200],
      }}
    />
  );
}

function FormeListe({ theme }: { theme: ThemeResolu }) {
  return (
    <View style={{ gap: theme.espace[4] }}>
      {[0, 1, 2].map((cle) => (
        <View
          key={cle}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.espace[3] }}
        >
          <View
            style={{
              width: theme.taille.avatarMd,
              height: theme.taille.avatarMd,
              borderRadius: theme.rayon.pilule,
              backgroundColor: theme.couleur.gris[200],
            }}
          />
          <View style={{ flex: 1, gap: theme.espace[1] }}>
            <Bloc largeur="60%" hauteur={14} theme={theme} />
            <Bloc largeur="40%" hauteur={12} theme={theme} />
          </View>
        </View>
      ))}
    </View>
  );
}

function FormeCarte({ theme }: { theme: ThemeResolu }) {
  return (
    <View style={{ gap: theme.espace[2] }}>
      <View
        style={{
          width: '100%',
          aspectRatio: 4 / 3,
          borderRadius: theme.rayon.media,
          backgroundColor: theme.couleur.gris[200],
        }}
      />
      <Bloc largeur="70%" hauteur={17} theme={theme} />
      <Bloc largeur="45%" hauteur={14} theme={theme} />
    </View>
  );
}

function FormeDetail({ theme }: { theme: ThemeResolu }) {
  return (
    <View style={{ gap: theme.espace[4] }}>
      <View
        style={{
          width: '100%',
          height: 200,
          borderRadius: theme.rayon.media,
          backgroundColor: theme.couleur.gris[200],
        }}
      />
      <Bloc largeur="80%" hauteur={22} theme={theme} />
      <View style={{ gap: theme.espace[1] }}>
        <Bloc largeur="100%" hauteur={16} theme={theme} />
        <Bloc largeur="100%" hauteur={16} theme={theme} />
        <Bloc largeur="65%" hauteur={16} theme={theme} />
      </View>
    </View>
  );
}

export function Squelette({ forme, testID }: ProprietesSquelette) {
  const theme = useTheme();
  const { actif: mouvementReduitActif } = useMouvementReduit();
  const opacite = useSharedValue(1);

  useEffect(() => {
    if (mouvementReduitActif) {
      opacite.value = 1;
      return;
    }
    opacite.value = withRepeat(
      withTiming(OPACITE_BASSE, { duration: DUREE_PULSATION / 2 }),
      -1,
      true,
    );
  }, [mouvementReduitActif, opacite]);

  const styleAnime = useAnimatedStyle(() => ({ opacity: opacite.value }));

  const contenu =
    forme === 'liste' ? (
      <FormeListe theme={theme} />
    ) : forme === 'carte' ? (
      <FormeCarte theme={theme} />
    ) : forme === 'detail' ? (
      <FormeDetail theme={theme} />
    ) : (
      <Bloc largeur="100%" hauteur={16} theme={theme} />
    );

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styleAnime}
    >
      {contenu}
    </Animated.View>
  );
}
