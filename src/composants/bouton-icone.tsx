import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icone, type NomIcone } from '@/composants/icones';
import { useMouvementReduit, useTheme } from '@/theme/fournisseur';

export type ProprietesBoutonIcone = {
  nom: NomIcone;
  // Pas de "?" : obligatoire, verifie par le type (docs/design-system.md §6). Une icone
  // seule sans libelle de lecteur d'ecran est un composant qui ne doit pas exister.
  accessibilityLabel: string;
  onPress: () => void;
  desactive?: boolean;
  actif?: boolean;
  couleur?: string;
  // Reserve a la galerie de developpement (app/_galerie.tsx) : voir ProprietesBouton dans
  // src/composants/bouton.tsx pour la raison d'etre complete.
  previsualiserEtat?: 'presse' | 'focus';
};

function courbeVersEasing(courbe: string) {
  const nombres = courbe.match(/-?\d*\.?\d+/g);
  const [x1, y1, x2, y2] = (nombres ?? ['0', '0', '1', '1']).map(Number);
  return Easing.bezier(x1, y1, x2, y2);
}

export function BoutonIcone({
  nom,
  accessibilityLabel,
  onPress,
  desactive = false,
  actif = false,
  couleur,
  previsualiserEtat,
}: ProprietesBoutonIcone) {
  const theme = useTheme();
  const {
    actif: mouvementReduitActif,
    appui: dureeAppui,
    courbe,
    echelleAppui,
  } = useMouvementReduit();
  const [estPresseInteraction, setEstPresse] = useState(false);
  const [estFocusInteraction, setEstFocus] = useState(false);
  const estPresse = previsualiserEtat === 'presse' || estPresseInteraction;
  const estFocus = previsualiserEtat === 'focus' || estFocusInteraction;
  const echelle = useSharedValue(1);

  const fond = desactive ? undefined : estPresse ? theme.couleur.gris[200] : undefined;
  const couleurIcone = desactive ? theme.couleur.texte.desactive : couleur;

  const styleAnime = useAnimatedStyle(() => ({ transform: [{ scale: echelle.value }] }));

  function surAppuiDebut() {
    setEstPresse(true);
    if (!mouvementReduitActif) {
      // La regle ne connait pas les SharedValue Reanimated et prend leur mutation prevue
      // par la librairie pour une mutation React classique interdite.
      // eslint-disable-next-line react-hooks/immutability
      echelle.value = withTiming(echelleAppui, {
        duration: dureeAppui,
        easing: courbeVersEasing(courbe),
      });
    }
  }

  function surAppuiFin() {
    setEstPresse(false);
    if (!mouvementReduitActif) {
      // eslint-disable-next-line react-hooks/immutability -- voir surAppuiDebut ci-dessus.
      echelle.value = withTiming(1, { duration: dureeAppui, easing: courbeVersEasing(courbe) });
    }
  }

  return (
    <Animated.View
      style={[
        estFocus && {
          borderRadius: theme.rayon.pilule + theme.taille.focusHalo + theme.taille.focusContour,
          padding: theme.taille.focusHalo,
          backgroundColor: theme.couleur.bordure.focusHalo,
        },
        styleAnime,
      ]}
    >
      <View
        style={
          estFocus && {
            borderRadius: theme.rayon.pilule + theme.taille.focusContour,
            borderWidth: theme.taille.focusContour,
            borderColor: theme.couleur.bordure.focus,
          }
        }
      >
        <Pressable
          onPress={onPress}
          onPressIn={surAppuiDebut}
          onPressOut={surAppuiFin}
          onFocus={() => setEstFocus(true)}
          onBlur={() => setEstFocus(false)}
          disabled={desactive}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: desactive }}
          style={{
            minWidth: theme.taille.tapMin,
            minHeight: theme.taille.tapMin,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.rayon.pilule,
            backgroundColor: fond,
          }}
        >
          <Icone nom={nom} couleur={couleurIcone} actif={actif} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
