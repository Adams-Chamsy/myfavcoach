import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useMouvementReduit, useTheme, type ThemeResolu } from '@/theme/fournisseur';

export type EtatSegment = 'atteint' | 'actuel' | 'reste';

export type ProprietesProgressionBarre = {
  variante?: 'barre';
  valeur: number; // 0 a 100
  accessibilityLabel: string;
};

export type ProprietesProgressionSegments = {
  variante: 'segments';
  segments: EtatSegment[];
  accessibilityLabel: string;
};

export type ProprietesProgression = ProprietesProgressionBarre | ProprietesProgressionSegments;

function courbeVersEasing(courbe: string) {
  const nombres = courbe.match(/-?\d*\.?\d+/g);
  const [x1, y1, x2, y2] = (nombres ?? ['0', '0', '1', '1']).map(Number);
  return Easing.bezier(x1, y1, x2, y2);
}

export function Progression(proprietes: ProprietesProgression) {
  const theme = useTheme();

  if (proprietes.variante === 'segments') {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={proprietes.accessibilityLabel}
        style={{ flexDirection: 'row', gap: theme.espace[1] + 2 }}
      >
        {proprietes.segments.map((etat, index) => (
          // segments sans identifiant propre, ordre stable
          <Segment key={index} etat={etat} theme={theme} />
        ))}
      </View>
    );
  }

  return (
    <ProgressionBarre
      valeur={proprietes.valeur}
      accessibilityLabel={proprietes.accessibilityLabel}
    />
  );
}

// docs/design-system.md §4 : la regle des 600 ms "uniquement quand la valeur change apres le
// montage" porte sur la progression en general, pas seulement sur la variante barre — un
// segment se remplit (ex. apres validation d'une seance), jamais au premier rendu.
function fractionCible(etat: EtatSegment) {
  return etat === 'reste' ? 0 : 1;
}

function couleurSegment(theme: ThemeResolu, etat: EtatSegment) {
  return etat === 'actuel' ? theme.couleur.marque.accent : theme.couleur.marque.primaire;
}

function Segment({ etat, theme }: { etat: EtatSegment; theme: ThemeResolu }) {
  const { actif: mouvementReduitActif, valeur: dureeValeur, courbe } = useMouvementReduit();
  // Initialise directement a la cible : le montage ne doit jamais animer.
  const remplissage = useSharedValue(fractionCible(etat));
  const monte = useRef(false);
  // Compare la fraction cible, pas l'etat brut : "actuel" -> "atteint" ne change pas le
  // remplissage (deja plein), seule sa couleur change — pas la peine de rejouer l'animation.
  const fractionPrecedente = useRef(fractionCible(etat));

  useEffect(() => {
    const cible = fractionCible(etat);
    if (!monte.current) {
      monte.current = true;
      fractionPrecedente.current = cible;
      return;
    }
    if (cible !== fractionPrecedente.current) {
      fractionPrecedente.current = cible;
      // La valeur doit rester exacte en mouvement reduit (c'est une information, pas une
      // decoration) : affectation immediate, sans transition animee, plutot que withTiming.
      if (mouvementReduitActif) {
        remplissage.value = cible;
      } else {
        remplissage.value = withTiming(cible, {
          duration: dureeValeur,
          easing: courbeVersEasing(courbe),
        });
      }
    }
    // remplissage est une SharedValue Reanimated, stable entre les rendus : pas necessaire aux deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat, mouvementReduitActif, dureeValeur, courbe]);

  const styleRemplissage = useAnimatedStyle(() => ({ width: `${remplissage.value * 100}%` }));

  return (
    <View
      style={{
        flex: 1,
        height: theme.espace[1] + 2,
        borderRadius: theme.rayon.pilule,
        backgroundColor: theme.couleur.gris[200],
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: theme.rayon.pilule,
            backgroundColor: couleurSegment(theme, etat),
          },
          styleRemplissage,
        ]}
      />
    </View>
  );
}

function ProgressionBarre({
  valeur,
  accessibilityLabel,
}: {
  valeur: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const { actif: mouvementReduitActif, valeur: dureeValeur, courbe } = useMouvementReduit();
  // Initialise directement a la valeur de depart : le montage ne doit jamais animer.
  const largeur = useSharedValue(valeur);
  const monte = useRef(false);

  useEffect(() => {
    if (!monte.current) {
      monte.current = true;
      return;
    }
    // Meme raison que Segment ci-dessus : valeur exacte immediate en mouvement reduit.
    if (mouvementReduitActif) {
      largeur.value = valeur;
    } else {
      largeur.value = withTiming(valeur, {
        duration: dureeValeur,
        easing: courbeVersEasing(courbe),
      });
    }
    // largeur est une SharedValue Reanimated, stable entre les rendus : pas necessaire aux deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, mouvementReduitActif, dureeValeur, courbe]);

  const styleBarre = useAnimatedStyle(() => ({ width: `${largeur.value}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: valeur }}
      style={{
        height: theme.espace[3],
        borderRadius: theme.rayon.pilule,
        backgroundColor: theme.couleur.gris[200],
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: theme.rayon.pilule,
            backgroundColor: theme.couleur.marque.primaire,
          },
          styleBarre,
        ]}
      />
    </View>
  );
}
