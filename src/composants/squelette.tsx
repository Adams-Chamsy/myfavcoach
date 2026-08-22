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

const OPACITE_BASSE = 0.55;

// Aucun ratio ni token de taille ne couvre le bloc media de la forme "detail" (portrait/hero
// d'un ecran de detail, distinct du plein cadre de profil coach a 400 pt) : constante locale
// documentee plutot qu'un ajout muet a design/tokens.json. Voir docs/dette.md.
const HAUTEUR_MEDIA_DETAIL = 200;

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
            <Bloc largeur="60%" hauteur={theme.texte.petit.lineHeight} theme={theme} />
            <Bloc largeur="40%" hauteur={theme.texte.legende.lineHeight} theme={theme} />
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
      <Bloc largeur="70%" hauteur={theme.texte.titre3.lineHeight} theme={theme} />
      <Bloc largeur="45%" hauteur={theme.texte.petit.lineHeight} theme={theme} />
    </View>
  );
}

function FormeDetail({ theme }: { theme: ThemeResolu }) {
  return (
    <View style={{ gap: theme.espace[4] }}>
      <View
        style={{
          width: '100%',
          height: HAUTEUR_MEDIA_DETAIL,
          borderRadius: theme.rayon.media,
          backgroundColor: theme.couleur.gris[200],
        }}
      />
      <Bloc largeur="80%" hauteur={theme.texte.titre2.lineHeight} theme={theme} />
      <View style={{ gap: theme.espace[1] }}>
        <Bloc largeur="100%" hauteur={theme.texte.corps.lineHeight} theme={theme} />
        <Bloc largeur="100%" hauteur={theme.texte.corps.lineHeight} theme={theme} />
        <Bloc largeur="65%" hauteur={theme.texte.corps.lineHeight} theme={theme} />
      </View>
    </View>
  );
}

export function Squelette({ forme, testID }: ProprietesSquelette) {
  const theme = useTheme();
  const { actif: mouvementReduitActif, pulsation } = useMouvementReduit();
  const opacite = useSharedValue(1);

  useEffect(() => {
    if (mouvementReduitActif) {
      opacite.value = 1;
      return;
    }
    opacite.value = withRepeat(withTiming(OPACITE_BASSE, { duration: pulsation / 2 }), -1, true);
  }, [mouvementReduitActif, opacite, pulsation]);

  const styleAnime = useAnimatedStyle(() => ({ opacity: opacite.value }));

  const contenu =
    forme === 'liste' ? (
      <FormeListe theme={theme} />
    ) : forme === 'carte' ? (
      <FormeCarte theme={theme} />
    ) : forme === 'detail' ? (
      <FormeDetail theme={theme} />
    ) : (
      <Bloc largeur="100%" hauteur={theme.texte.corps.lineHeight} theme={theme} />
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
