import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { EcranSeanceDuJour } from '@/fonctionnalites/seance/ecran-seance-du-jour';

// docs/ecrans/L6-05-seance-du-jour.md. Aucune logique ici (CLAUDE.md §5).
export default function SeanceDuJourEcran() {
  const router = useRouter();
  const { seanceProgrammeeId } = useLocalSearchParams<{ seanceProgrammeeId?: string }>();
  const versAccueil = () =>
    router.canGoBack() ? router.back() : router.replace('/(client)/(tabs)/accueil' as Href);
  if (!seanceProgrammeeId) return <Redirect href={'/(client)/(tabs)/accueil' as Href} />;
  return (
    <EcranSeanceDuJour
      seanceProgrammeeId={seanceProgrammeeId}
      onRetour={versAccueil}
      onTerminee={versAccueil}
      ouvrirPage={async (url) => {
        // La démo s'ouvre à côté de la séance, sans la quitter : un onglet sur le web.
        if (Platform.OS === 'web') {
          window.open(url, '_blank', 'noopener');
          return;
        }
        await WebBrowser.openBrowserAsync(url);
      }}
    />
  );
}
