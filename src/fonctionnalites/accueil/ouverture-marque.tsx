import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import {
  ClipPath,
  Filter,
  FeGaussianBlur,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Svg,
} from 'react-native-svg';
import { traceRubanMarque, traceCorpsMarque } from '@/composants/marque';
import { useSession } from '@/fonctionnalites/identite/fournisseur-session';
import { useMouvementReduit, useTheme } from '@/theme/fournisseur';
import { accueil as mesure, themes } from '@/theme/tokens';
import { useParcoursVisiteur } from './fournisseur-parcours-visiteur';

const FilAnime = Animated.createAnimatedComponent(Path);
const GroupeAnime = Animated.createAnimatedComponent(G);
const RectangleAnime = Animated.createAnimatedComponent(Rect);

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
  const { width } = useWindowDimensions();
  const reduit = mouvementReduit ?? (!mouvement.pret || mouvement.actif);
  const statique = !longue || reduit;
  const temps = useSharedValue(0);
  const opacite = useSharedValue(1);
  const duree = reduit
    ? mouvement.ouvertureReduite
    : longue
      ? mouvement.ouverture
      : mouvement.ouvertureBreve;
  const sortie = reduit ? 0 : mouvement.ouvertureSortie;
  useEffect(() => {
    temps.value = withTiming(duree, { duration: duree, easing: Easing.linear });
    const finMarque = setTimeout(() => {
      opacite.value = withTiming(0, { duration: sortie });
    }, duree);
    const fin = setTimeout(onTerminee, duree + sortie);
    return () => {
      clearTimeout(finMarque);
      clearTimeout(fin);
      cancelAnimation(temps);
      cancelAnimation(opacite);
    };
  }, [temps, opacite, duree, sortie, onTerminee]);
  const cadre = useAnimatedStyle(() => ({ opacity: opacite.value }));
  const progression = (delai: number, dureeEtape: number) => {
    'worklet';
    return statique
      ? 1
      : Easing.bezierFn(
          0.16,
          1,
          0.3,
          1,
        )(interpolate(temps.value, [delai, delai + dureeEtape], [0, 1], Extrapolation.CLAMP));
  };
  const ruban = useAnimatedProps(() => {
    const p = progression(mesure.rubanDelai, mesure.rubanDuree);
    return { opacity: p, transform: `translate(${8 * (1 - p)} ${-6 * (1 - p)})` };
  });
  const masqueRuban = useAnimatedProps(() => ({
    height: 200 * progression(mesure.rubanDelai, mesure.rubanDuree),
  }));
  const corps = useAnimatedProps(() => {
    const p = progression(mesure.corpsDelai, mesure.corpsDuree);
    return {
      opacity: p,
      transform: `translate(0 ${8 * (1 - p)}) translate(100 100) scale(${0.96 + 0.04 * p}) translate(-100 -100)`,
    };
  });
  const masqueCorps = useAnimatedProps(() => {
    const p = progression(mesure.corpsDelai, mesure.corpsDuree);
    return { y: 200 * (1 - p), height: 200 * p };
  });
  const nom = useAnimatedStyle(() => {
    const p = progression(mesure.nomDelai, mesure.nomDuree);
    return { opacity: p, transform: [{ translateY: mesure.nomTranslation * (1 - p) }] };
  });
  const legende = useAnimatedStyle(() => {
    const p = progression(mesure.legendeDelai, mesure.legendeDuree);
    return { opacity: p, transform: [{ translateY: mesure.nomTranslation * (1 - p) }] };
  });
  const halo = useAnimatedStyle(() => ({
    opacity: statique
      ? 0
      : interpolate(
          temps.value,
          [
            mesure.haloDelai,
            mesure.haloDelai + mesure.haloDuree * 0.6,
            mesure.haloDelai + mesure.haloDuree,
          ],
          [0, 1, 0.5],
          Extrapolation.CLAMP,
        ),
    transform: [
      {
        scale: interpolate(
          temps.value,
          [mesure.haloDelai, mesure.haloDelai + mesure.haloDuree],
          [0.4, 1.25],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const soie = useAnimatedStyle(() => ({
    opacity: statique
      ? 0
      : interpolate(
          temps.value,
          [0, mesure.filPassage * 0.2, mesure.filPassage * 0.7, mesure.filPassage],
          [0, 1, 0.65, 0],
          Extrapolation.CLAMP,
        ),
    transform: [
      {
        translateX: interpolate(
          temps.value,
          [0, mesure.filPassage],
          [-20, 30],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          temps.value,
          [0, mesure.filPassage],
          [20, -30],
          Extrapolation.CLAMP,
        ),
      },
      { scale: interpolate(temps.value, [0, mesure.filPassage], [0.9, 1.05], Extrapolation.CLAMP) },
    ],
  }));
  const fil = useAnimatedProps(() => ({
    strokeDashoffset:
      mesure.filLongueur *
      (1 -
        Easing.bezierFn(
          0.22,
          0.61,
          0.36,
          1,
        )(interpolate(temps.value, [0, mesure.filDuree], [0, 1], Extrapolation.CLAMP))),
  }));
  const largeurFil = Math.min(width * mesure.filRatio, mesure.filMax);
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
          overflow: 'hidden',
        },
        cadre,
      ]}
    >
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundImage: `radial-gradient(ellipse at ${mesure.fondLumiereX}% ${mesure.fondLumiereY}%, ${themes.clair.marque.signatureLumiere}, transparent ${mesure.fondLumiereFin}%), linear-gradient(${mesure.fondOmbreAngle}deg, transparent, ${themes.clair.marque.signatureOmbre})`,
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: mesure.halo,
            height: mesure.halo,
            backgroundImage: `radial-gradient(circle, ${themes.clair.marque.signatureHalo}, transparent ${mesure.haloFin}%)`,
          },
          halo,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: largeurFil, height: largeurFil }, soie]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 600 600">
          <Defs>
            <Filter id="soie-floue">
              <FeGaussianBlur stdDeviation="5" />
            </Filter>
            <LinearGradient id="ruban-ouverture">
              <Stop stopColor={themes.clair.marque.signatureFilDebut} />
              <Stop offset=".6" stopColor={themes.clair.marque.signatureFilMilieu} />
              <Stop offset="1" stopColor={themes.clair.marque.ruban} />
            </LinearGradient>
          </Defs>
          <FilAnime
            d="M-40 435 C90 480 154 330 270 315 S410 120 660 130"
            fill="none"
            stroke="url(#ruban-ouverture)"
            filter="url(#soie-floue)"
            strokeWidth={mesure.filHaloTrait}
            opacity={mesure.filHaloOpacite}
            strokeLinecap="round"
            strokeDasharray={mesure.filLongueur}
            animatedProps={fil}
          />
          <FilAnime
            d="M-40 435 C90 480 154 330 270 315 S410 120 660 130"
            fill="none"
            stroke="url(#ruban-ouverture)"
            strokeWidth={mesure.filTrait}
            strokeLinecap="round"
            strokeDasharray={mesure.filLongueur}
            animatedProps={fil}
          />
        </Svg>
      </Animated.View>
      <View style={{ alignItems: 'center', width: '100%', padding: mesure.signaturePadding }}>
        <View accessible accessibilityRole="image" accessibilityLabel="MyFavCoach">
          <Svg
            width={theme.taille.symboleOuverture}
            height={theme.taille.symboleOuverture}
            viewBox="0 0 200 200"
          >
            <Defs>
              <ClipPath id="marque-ruban-masque">
                <RectangleAnime width="200" animatedProps={masqueRuban} />
              </ClipPath>
              <ClipPath id="marque-corps-masque">
                <RectangleAnime width="200" animatedProps={masqueCorps} />
              </ClipPath>
            </Defs>
            <GroupeAnime clipPath="url(#marque-ruban-masque)" animatedProps={ruban}>
              <Path d={traceRubanMarque} fill={themes.clair.marque.ruban} fillRule="evenodd" />
            </GroupeAnime>
            <GroupeAnime clipPath="url(#marque-corps-masque)" animatedProps={corps}>
              <Path d={traceCorpsMarque} fill={themes.clair.texte.surMarque} fillRule="evenodd" />
            </GroupeAnime>
          </Svg>
        </View>
        <Animated.Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              fontFamily: theme.texte.marque.fontFamily,
              fontSize: mesure.signatureNom,
              lineHeight: mesure.signatureNom * mesure.interligne,
              letterSpacing: mesure.signatureNomInterlettrage,
              marginTop: mesure.signatureNomHaut,
              color: themes.clair.texte.surMarque,
            },
            nom,
          ]}
        >
          MyFav<Text style={{ color: themes.clair.marque.ruban }}>Coach</Text>
        </Animated.Text>
        <Animated.Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            {
              fontFamily: theme.texte.corps.fontFamily,
              fontSize: mesure.signatureLegende,
              lineHeight: mesure.signatureLegende * mesure.interligne,
              letterSpacing: mesure.signatureLegendeInterlettrage,
              marginTop: mesure.signatureLegendeHaut,
              color: themes.clair.texte.surMarque,
            },
            legende,
          ]}
        >
          Un vrai coach. Pour avancer.
        </Animated.Text>
      </View>
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
