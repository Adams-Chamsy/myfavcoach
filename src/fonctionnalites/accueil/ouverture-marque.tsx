import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

import { SymboleMarque } from '@/composants/marque';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useMouvementReduit, useTheme } from '@/theme/fournisseur';
import { themes } from '@/theme/tokens';
import { useParcoursVisiteur } from './fournisseur-parcours-visiteur';

const FilAnime = Animated.createAnimatedComponent(Path);

export function SignatureMarque({
  longue,
  onTerminee,
  mouvementReduit,
}: {
  longue: boolean;
  onTerminee: () => void;
  mouvementReduit?: boolean;
}): ReactElement {
  const theme = useTheme();
  const mouvement = useMouvementReduit();
  const reduit = mouvementReduit ?? (!mouvement.pret || mouvement.actif);
  const avancement = useSharedValue(0);
  const opacite = useSharedValue(1);
  const duree = mouvement.actif
    ? mouvement.ouvertureReduite
    : longue
      ? mouvement.ouverture
      : mouvement.ouvertureBreve;
  const sortie = reduit ? 0 : mouvement.ouvertureSortie;
  useEffect(() => {
    avancement.value = withTiming(1, { duration: duree, easing: Easing.linear });
    const finMarque = setTimeout(() => {
      opacite.value = withTiming(0, { duration: sortie });
    }, duree);
    const fin = setTimeout(onTerminee, duree + sortie);
    return () => {
      clearTimeout(finMarque);
      clearTimeout(fin);
      cancelAnimation(avancement);
      cancelAnimation(opacite);
    };
  }, [avancement, opacite, duree, sortie, onTerminee]);
  const cadre = useAnimatedStyle(() => ({ opacity: opacite.value }));
  const symbole = useAnimatedStyle(() => ({
    opacity:
      !longue || reduit
        ? 1
        : interpolate(avancement.value, [0, 0.22, 0.65], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY:
          !longue || reduit
            ? 0
            : interpolate(avancement.value, [0, 0.65], [theme.espace[2], 0], Extrapolation.CLAMP),
      },
    ],
  }));
  const nom = useAnimatedStyle(() => ({
    opacity:
      !longue || reduit
        ? 1
        : interpolate(avancement.value, [0, 0.55, 0.85], [0, 0, 1], Extrapolation.CLAMP),
  }));
  const fil = useAnimatedProps(() => ({
    strokeDashoffset: theme.taille.filOuverture * 2 * (1 - avancement.value),
    opacity:
      !longue || reduit
        ? 0
        : interpolate(avancement.value, [0, 0.15, 0.65, 0.9], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View
      testID="signature-marque"
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: themes.clair.marque.primaireProfond,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.espace[6],
        },
        cadre,
      ]}
    >
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width="100%" height="100%" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id="ruban-ouverture">
              <Stop stopColor={themes.clair.marque.ruban} />
              <Stop offset=".7" stopColor={themes.clair.texte.surMarque} />
              <Stop offset="1" stopColor={themes.clair.marque.ruban} />
            </LinearGradient>
          </Defs>
          <FilAnime
            d="M-40 435 C90 480 154 330 270 315 S410 120 660 130"
            fill="none"
            stroke="url(#ruban-ouverture)"
            strokeWidth={theme.taille.iconeTraitActif}
            strokeLinecap="round"
            strokeDasharray={theme.taille.filOuverture * 2}
            animatedProps={fil}
          />
        </Svg>
      </View>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel="MyFavCoach"
        style={symbole}
      >
        <SymboleMarque
          taille={theme.taille.symboleOuverture}
          couleur={themes.clair.texte.surMarque}
        />
      </Animated.View>
      <Animated.View
        style={[{ alignItems: 'center', gap: theme.espace[3], paddingTop: theme.espace[6] }, nom]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          style={{
            ...theme.texte.marque,
            fontSize: theme.texte.titre2.fontSize,
            lineHeight: theme.texte.titre2.lineHeight,
            color: themes.clair.texte.surMarque,
          }}
        >
          MyFav<Text style={{ color: themes.clair.marque.ruban }}>Coach</Text>
        </Text>
        <Text style={{ ...theme.texte.legende, color: themes.clair.texte.surMarque }}>
          Un vrai coach. Pour avancer.
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

type Phase = 'attente' | 'longue' | 'breve' | 'terminee';

export function OuvertureMarque({ children }: { children: ReactNode }): ReactElement {
  const parcours = useParcoursVisiteur();
  const { terminerOuverture } = parcours;
  const { session, chargement: sessionEnLecture } = useSession();
  const mouvement = useMouvementReduit();
  const [phase, setPhase] = useState<Phase>('attente');
  // Choix dérivé une seule fois : une connexion terminée pendant le mouvement ne relance
  // pas l'introduction. Si la session est encore inconnue, on privilégie la version brève.
  if (phase === 'attente' && !parcours.chargement && mouvement.pret)
    setPhase(!parcours.marqueVue && !session && !sessionEnLecture ? 'longue' : 'breve');
  const terminer = useCallback(() => {
    setPhase('terminee');
    terminerOuverture();
  }, [terminerOuverture]);
  const visible = phase !== 'terminee';
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        pointerEvents={visible ? 'none' : 'auto'}
        accessibilityElementsHidden={visible}
        importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {phase === 'attente' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: themes.clair.marque.primaireProfond },
          ]}
        />
      ) : phase !== 'terminee' ? (
        <SignatureMarque
          longue={phase === 'longue'}
          mouvementReduit={mouvement.actif}
          onTerminee={terminer}
        />
      ) : null}
    </View>
  );
}
