import { Image, Text, View } from 'react-native';

import { useTheme } from '@/theme/fournisseur';
import { font } from '@/theme/tokens';

export type RatioEmplacementImage = 'portrait3x4' | 'paysage4x3' | 'pleinCadre';

export type ProprietesEmplacementImage = {
  nom: string;
  ratio: RatioEmplacementImage;
  // Aucune photo n'existe dans le dossier de design a ce jour : cette prop reste optionnelle
  // pour le jour ou une source arrive, mais aucun ecran ne la fournit encore.
  source?: string;
};

const RATIOS: Record<'portrait3x4' | 'paysage4x3', number> = {
  portrait3x4: 3 / 4,
  paysage4x3: 4 / 3,
};

// docs/design-system.md §7 : "plein cadre 400 pt de haut pour l'en-tete du profil coach".
// Ce n'est pas un ratio mais une hauteur fixe, et design/tokens.json n'a pas de token pour
// 400 : constante locale documentee plutot qu'un ajout muet. Voir docs/dette.md.
const HAUTEUR_PLEIN_CADRE = 400;

function initiales(nom: string) {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join('');
}

export function EmplacementImage({ nom, ratio, source }: ProprietesEmplacementImage) {
  const theme = useTheme();
  const styleDimension =
    ratio === 'pleinCadre' ? { height: HAUTEUR_PLEIN_CADRE } : { aspectRatio: RATIOS[ratio] };

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
        backgroundColor: theme.couleur.marque.primaire,
        alignItems: 'center',
        justifyContent: 'center',
        ...styleDimension,
      }}
    >
      <Text
        // Manrope grasse, pas Instrument Serif : cette derniere n'a pas de graisse grasse
        // embarquee (ni chez Google Fonts). Meme choix qu'Avatar (src/composants/avatar.tsx)
        // pour un repli d'initiales coherent entre les deux composants ; taille et
        // interlignage repris de texte.titre1 pour garder les proportions d'origine.
        style={{
          fontFamily: font.uiBold,
          fontSize: theme.texte.titre1.fontSize,
          lineHeight: theme.texte.titre1.lineHeight,
          color: theme.couleur.texte.surMarque,
        }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {initiales(nom)}
      </Text>
    </View>
  );
}
