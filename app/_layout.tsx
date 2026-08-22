import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FournisseurTheme } from '@/theme/fournisseur';

// Garde l'ecran de lancement natif visible tant que les polices n'ont pas fini de charger, avec
// succes ou en echec : jamais d'ecran blanc au moment ou elles arrivent
// (docs/ecrans/L0-04-demarrage.md, critere 1 et sequence, etapes 1-2). Appel au chargement du
// module, avant le premier rendu.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Deja appele (fast refresh en developpement) : sans consequence.
});

// Racine de l'application : fournit le theme et les zones sures a toutes les routes.
// SafeAreaProvider est requis par useSafeAreaInsets() (utilise par les barres de navigation
// des coquilles client et coach) et par Tabs lui-meme, qui detecte ses "insets" automatiquement.
//
// Theme sombre systeme ignore, sans exception (docs/perimetre.md §3 : mode sombre non concu
// ecran par ecran, non livre au jalon 1). FournisseurTheme (src/theme/fournisseur.tsx) force
// "clair" et ne lit jamais useColorScheme() ; "userInterfaceStyle": "light" dans app.json le
// renforce au niveau natif. Ne "corrige" ni l'un ni l'autre pour suivre le systeme avant que le
// mode sombre soit reellement concu et livre — voir le commentaire dans fournisseur.tsx.
export default function LayoutRacine() {
  const [policesChargees, erreurPolices] = useFonts({
    InstrumentSerif_400Regular,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (!policesChargees && !erreurPolices) return;

    // Une police en echec ne bloque jamais le demarrage : repli sur la police systeme plutot
    // qu'un ecran fige (docs/ecrans/L0-04-demarrage.md, regle "si une police echoue... incident
    // journalise").
    if (erreurPolices) {
      console.error(
        'Echec du chargement des polices embarquees, repli sur la police systeme',
        erreurPolices,
      );
    }
    SplashScreen.hideAsync();
  }, [policesChargees, erreurPolices]);

  // Aucun rendu JS tant que les polices ne sont pas resolues (chargees ou en echec) : l'ecran
  // natif de lancement reste seul visible, pas de flash sans police puis avec.
  if (!policesChargees && !erreurPolices) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <FournisseurTheme>
        <Stack screenOptions={{ headerShown: false }} />
      </FournisseurTheme>
    </SafeAreaProvider>
  );
}
