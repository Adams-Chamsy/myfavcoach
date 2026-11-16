import {
  Platform,
  ScrollView,
  type ScrollViewProps,
  useWindowDimensions,
  View,
  type ViewProps,
} from 'react-native';

import { useTheme } from '@/theme/fournisseur';

export function useDispositionEcran() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // Le responsive concerne le rendu web ; il ne construit pas une version tablette native.
  const large = Platform.OS === 'web' && width > theme.seuil.tablette;
  return { large, largeur: width };
}

/** Largeur de lecture commune, sans modifier les parcours ou les zones sûres des écrans. */
export function CanevasEcran({
  style,
  ample = false,
  largeurMax,
  ...props
}: ViewProps & { ample?: boolean; largeurMax?: number }) {
  const theme = useTheme();
  const { large } = useDispositionEcran();
  return (
    <View
      {...props}
      style={[
        style,
        {
          width: '100%',
          alignSelf: 'center',
          maxWidth: large
            ? (largeurMax ?? (ample ? theme.taille.contenu : theme.taille.lecture))
            : undefined,
        },
      ]}
    />
  );
}

/** Les champs gardent une largeur lisible sur desktop, sans contraindre le défilement natif. */
export function DefilementEcran({
  contentContainerStyle,
  ample = false,
  largeurMax,
  ...props
}: ScrollViewProps & { ample?: boolean; largeurMax?: number }) {
  const theme = useTheme();
  const { large } = useDispositionEcran();
  return (
    <ScrollView
      {...props}
      keyboardShouldPersistTaps={props.keyboardShouldPersistTaps ?? 'handled'}
      contentContainerStyle={[
        contentContainerStyle,
        {
          width: '100%',
          alignSelf: 'center',
          maxWidth: large
            ? (largeurMax ?? (ample ? theme.taille.contenu : theme.taille.lecture))
            : undefined,
        },
      ]}
    />
  );
}
