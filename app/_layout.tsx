import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FournisseurDonnees } from '@/fonctionnalites/identite/fournisseur-donnees';
import { FournisseurSession } from '@/fonctionnalites/identite/fournisseur-session';
import { portAuthSupabase } from '@/services/auth/supabase';
import { portDonneesSupabase } from '@/services/donnees/supabase';
import { FournisseurTheme } from '@/theme/fournisseur';

// Deux liens profonds reçus par courriel, au démarrage à froid SEULEMENT — l'URL qui a lancé
// cette instance de l'application. Traité ici, pas dans les écrans concernés, parce qu'aucun
// des deux n'est forcément monté à froid (ni myfavcoach://auth/rappel ni
// myfavcoach://auth/mot-de-passe ne sont la route d'un écran réel, expo-router ne peut pas y
// naviguer). Les écrans concernés écoutent séparément les liens reçus PENDANT qu'ils sont
// montés (addEventListener('url', ...), jamais getInitialURL ici ET là : le même lien serait
// échangé deux fois, la seconde toujours refusée comme "déjà utilisé".
function traiterLienDemarrageAFroid(url: string | null) {
  if (!url) return;

  if (url.includes('auth/rappel')) {
    portAuthSupabase.etablirSessionDepuisLien(url).catch(() => {
      // Échec déjà traduit en ResultatAuth par le port — jamais un rejet en usage normal. Ce
      // catch n'est qu'un filet pour une URL malformée (ex. new URL() qui lève) ; _layout.tsx
      // n'a aucune interface pour afficher une erreur : l'utilisateur reste sur l'espace
      // public, recommence depuis "Renvoyer l'e-mail" si besoin.
    });
    return;
  }

  if (url.includes('auth/mot-de-passe')) {
    // Différent du cas ci-dessus : ÉCHANGER LE CODE ICI SERAIT UNE ERREUR. Une session de
    // récupération fraîchement établie n'est pas distinguable d'une session normale pour
    // garde.ts (même SessionAuth, même emailVerifie=true) — la laisser au routage générique de
    // app/index.tsx enverrait directement dans l'espace du profil actif, sautant le changement
    // de mot de passe. On navigue donc directement vers l'écran dédié, qui échange le code
    // lui-même à son montage : Linking.getInitialURL() est idempotent (relire l'URL ne
    // consomme rien), seul etablirSessionDepuisLien(url) consomme le code — jamais appelé ici.
    router.replace('/(public)/nouveau-mot-de-passe' as Href);
  }
}

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

  // Lien profond traité APRÈS le chargement des polices et du thème, jamais avant
  // (docs/ecrans/L1-03-verification-email.md, "Retour dans l'application") : même garde que
  // l'effet ci-dessus (polices chargées OU en échec), un seul appel par lancement.
  useEffect(() => {
    if (!policesChargees && !erreurPolices) return;
    Linking.getInitialURL().then(traiterLienDemarrageAFroid);
  }, [policesChargees, erreurPolices]);

  // Aucun rendu JS tant que les polices ne sont pas resolues (chargees ou en echec) : l'ecran
  // natif de lancement reste seul visible, pas de flash sans police puis avec.
  if (!policesChargees && !erreurPolices) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <FournisseurTheme>
        <FournisseurSession port={portAuthSupabase}>
          <FournisseurDonnees port={portDonneesSupabase}>
            <Stack screenOptions={{ headerShown: false }} />
          </FournisseurDonnees>
        </FournisseurSession>
      </FournisseurTheme>
    </SafeAreaProvider>
  );
}
