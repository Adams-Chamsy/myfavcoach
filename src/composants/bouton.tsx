import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icone, type NomIcone } from '@/composants/icones';
import { useMouvementReduit, useTheme, type ThemeResolu } from '@/theme/fournisseur';

export type VarianteBouton = 'primaire' | 'secondaire' | 'discret' | 'accent' | 'destructeur';

export type ProprietesBouton = {
  libelle: string;
  onPress: () => void;
  variante?: VarianteBouton;
  desactive?: boolean;
  icone?: NomIcone;
};

// Bordure propre a la variante secondaire (maquette : 1,5px). Meme valeur numerique que
// taille.focusContour par coincidence, mais deux concepts distincts — pas de token commun.
const EPAISSEUR_BORDURE_SECONDAIRE = 1.5;

type CouleursVariante = {
  fond?: string;
  fondPresse?: string;
  fondDesactive?: string;
  texte: string;
  textePresse?: string;
  texteDesactive: string;
  bordure?: string;
  bordurePresse?: string;
  bordureDesactive?: string;
};

// ATTENTION, correction obligatoire par rapport a la maquette (docs/design-system.md §1.1) :
// la variante accent remplit avec marque.accentAction (#C1471F, 4,74:1 avec accentEncre),
// jamais marque.accent (#E2603C, 3,32:1 seulement — insuffisant pour un libelle clair).
function couleursVariante(theme: ThemeResolu, variante: VarianteBouton): CouleursVariante {
  const { couleur } = theme;
  switch (variante) {
    case 'primaire':
      return {
        fond: couleur.marque.primaire,
        fondPresse: couleur.marque.primaireAppui,
        fondDesactive: couleur.gris[200],
        texte: couleur.texte.surMarque,
        textePresse: couleur.marque.primaireTeinte2,
        texteDesactive: couleur.gris[400],
      };
    case 'secondaire':
      return {
        fond: couleur.fond.canevas,
        fondPresse: couleur.gris[200],
        fondDesactive: couleur.fond.canevas,
        texte: couleur.texte.principal,
        texteDesactive: couleur.texte.desactive,
        bordure: couleur.texte.principal,
        bordurePresse: couleur.texte.principal,
        bordureDesactive: couleur.bordure.marquee,
      };
    case 'discret':
      return {
        fondPresse: couleur.marque.primaireTeinte2,
        texte: couleur.marque.primaire,
        textePresse: couleur.marque.primaireSurvol,
        texteDesactive: couleur.texte.desactive,
      };
    case 'accent':
      return {
        fond: couleur.marque.accentAction,
        fondPresse: couleur.marque.accentActionAppui,
        fondDesactive: couleur.gris[200],
        texte: couleur.marque.accentEncre,
        textePresse: couleur.marque.accentEncre,
        texteDesactive: couleur.gris[400],
      };
    case 'destructeur':
      // Pas de token "erreurAppui" dedie : etat.erreurEncre (deja plus fonce, pense pour le
      // texte sur fond clair) sert ici d'etat presse, seul ton plus sombre disponible.
      return {
        fond: couleur.etat.erreur,
        fondPresse: couleur.etat.erreurEncre,
        fondDesactive: couleur.gris[200],
        texte: couleur.texte.surMarque,
        textePresse: couleur.texte.surMarque,
        texteDesactive: couleur.gris[400],
      };
  }
}

function courbeVersEasing(courbe: string) {
  const nombres = courbe.match(/-?\d*\.?\d+/g);
  const [x1, y1, x2, y2] = (nombres ?? ['0', '0', '1', '1']).map(Number);
  return Easing.bezier(x1, y1, x2, y2);
}

export function Bouton({
  libelle,
  onPress,
  variante = 'primaire',
  desactive = false,
  icone,
}: ProprietesBouton) {
  const theme = useTheme();
  const {
    actif: mouvementReduitActif,
    appui: dureeAppui,
    courbe,
    echelleAppui,
  } = useMouvementReduit();
  const [estPresse, setEstPresse] = useState(false);
  const [estFocus, setEstFocus] = useState(false);
  const echelle = useSharedValue(1);

  const couleurs = couleursVariante(theme, variante);
  const fond = desactive ? couleurs.fondDesactive : estPresse ? couleurs.fondPresse : couleurs.fond;
  const texte = desactive
    ? couleurs.texteDesactive
    : estPresse
      ? (couleurs.textePresse ?? couleurs.texte)
      : couleurs.texte;
  const bordure = desactive
    ? couleurs.bordureDesactive
    : estPresse
      ? (couleurs.bordurePresse ?? couleurs.bordure)
      : couleurs.bordure;

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
      // eslint-disable-next-line react-hooks/immutability -- voir surAppuiDebut
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
          accessibilityState={{ disabled: desactive }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.espace[2],
            minHeight: theme.taille.tapDefaut,
            paddingHorizontal: theme.espace[6],
            borderRadius: theme.rayon.pilule,
            backgroundColor: fond,
            borderWidth: bordure ? EPAISSEUR_BORDURE_SECONDAIRE : 0,
            borderColor: bordure,
          }}
        >
          {icone ? <Icone nom={icone} taille={18} couleur={texte} /> : null}
          <Text style={{ ...theme.texte.actionAccent, color: texte }}>{libelle}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
