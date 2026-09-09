import { Image, Text, View } from 'react-native';

import { initiales } from '@/composants/initiales';
import { useTheme } from '@/theme/fournisseur';
import { font } from '@/theme/tokens';

export type RatioEmplacementImage = 'portrait3x4' | 'paysage4x3' | 'pleinCadre';

export type ProprietesEmplacementImage = {
  nom: string;
  ratio: RatioEmplacementImage;
  // Aucune photo n'existe dans le dossier de design a ce jour : cette prop reste optionnelle
  // pour le jour ou une source arrive, mais aucun ecran ne la fournit encore.
  source?: string;
  // "pleinCadre" fixe par defaut la hauteur du futur en-tete de profil coach (taille.pleinCadre,
  // 400 pt, docs/design-system.md §7). Un fond plein ecran (docs/ecrans/L1-01-bienvenue.md) a
  // besoin d'occuper tout l'espace flex disponible, pas une hauteur fixe : "remplir" bascule sur
  // flex:1 sans toucher au sens de taille.pleinCadre pour l'usage d'origine. Ignore en dehors du
  // ratio "pleinCadre".
  remplir?: boolean;
  // Couleurs du repli typographique. Par defaut marque.primaire / texte.surMarque LUS PAR LE
  // CONTEXTE (comme Avatar) : correct pour un repli au fil d'une liste, qui suit le theme
  // ambiant. Une surface qui fixe son propre theme (ile sombre : docs/ecrans/L1-01-bienvenue.md,
  // CLAUDE.md §5) doit au contraire passer des valeurs EXPLICITES d'un theme choisi
  // (themes.clair.* / themes.sombre.*), sinon le repli s'inverse sous une passe de theme
  // differente (npm run test:a11y en sombre) et devient illisible sous le degrade de l'ecran.
  fondRepli?: string;
  couleurTexteRepli?: string;
};

const RATIOS: Record<'portrait3x4' | 'paysage4x3', number> = {
  portrait3x4: 3 / 4,
  paysage4x3: 4 / 3,
};

export function EmplacementImage({
  nom,
  ratio,
  source,
  remplir = false,
  fondRepli,
  couleurTexteRepli,
}: ProprietesEmplacementImage) {
  const theme = useTheme();
  const fond = fondRepli ?? theme.couleur.marque.primaire;
  const couleurTexte = couleurTexteRepli ?? theme.couleur.texte.surMarque;
  const styleDimension =
    ratio === 'pleinCadre'
      ? remplir
        ? { flex: 1 }
        : { height: theme.taille.pleinCadre }
      : { aspectRatio: RATIOS[ratio] };

  if (source) {
    return (
      <Image
        source={{ uri: source }}
        accessibilityLabel={nom}
        style={{ width: '100%', borderRadius: theme.rayon.media, ...styleDimension }}
      />
    );
  }

  // Jamais de zone vide : repli typographique tant qu'aucune source n'est fournie
  // (docs/design-system.md §7), sur marque.primaire comme Avatar.
  return (
    <View
      accessible
      accessibilityLabel={nom}
      style={{
        width: '100%',
        borderRadius: theme.rayon.media,
        backgroundColor: fond,
        alignItems: 'center',
        justifyContent: 'center',
        ...styleDimension,
      }}
    >
      <Text
        // Manrope grasse, jamais Instrument Serif : des initiales de repli sont de
        // l'information utilitaire, pas de l'editorial — Instrument Serif est reserve aux
        // titres et aux chiffres cles (docs/design-system.md §3 et §7). Meme traitement dans
        // Avatar (src/composants/avatar.tsx) ; taille et interlignage repris de texte.titre1
        // pour garder les proportions d'origine (pas de token dedie a ce repli).
        style={{
          fontFamily: font.uiBold,
          fontSize: theme.texte.titre1.fontSize,
          lineHeight: theme.texte.titre1.lineHeight,
          color: couleurTexte,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {initiales(nom)}
      </Text>
    </View>
  );
}
