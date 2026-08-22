import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FournisseurTheme } from '@/theme/fournisseur';

// Racine de l'application : fournit le theme et les zones sures a toutes les routes.
// SafeAreaProvider est requis par useSafeAreaInsets() (utilise par les barres de navigation
// des coquilles client et coach) et par Tabs lui-meme, qui detecte ses "insets" automatiquement.
export default function LayoutRacine() {
  return (
    <SafeAreaProvider>
      <FournisseurTheme>
        <Stack screenOptions={{ headerShown: false }} />
      </FournisseurTheme>
    </SafeAreaProvider>
  );
}
