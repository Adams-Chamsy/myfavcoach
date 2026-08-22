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
};

const RATIOS: Record<'portrait3x4' | 'paysage4x3', number> = {
  portrait3x4: 3 / 4,
  paysage4x3: 4 / 3,
};

export function EmplacementImage({ nom, ratio, source }: ProprietesEmplacementImage) {
  const theme = useTheme();
  const styleDimension =
    ratio === 'pleinCadre' ? { height: theme.taille.pleinCadre } : { aspectRatio: RATIOS[ratio] };

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
        // Manrope grasse, jamais Instrument Serif : des initiales de repli sont de
        // l'information utilitaire, pas de l'editorial — Instrument Serif est reserve aux
        // titres et aux chiffres cles (docs/design-system.md §3 et §7). Meme traitement dans
        // Avatar (src/composants/avatar.tsx) ; taille et interlignage repris de texte.titre1
        // pour garder les proportions d'origine (pas de token dedie a ce repli).
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
