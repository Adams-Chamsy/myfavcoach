import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { EcranSeance } from '@/fonctionnalites/studio/ecran-seance';

// docs/ecrans/L6-11-studio.md, « Une séance ». Le programme voyage dans l'adresse : le serveur
// n'a pas de lecture d'une séance seule, l'écran la trouve dans son programme.
export default function SeanceStudioEcran() {
  const router = useRouter();
  const { seanceId, programme } = useLocalSearchParams<{ seanceId?: string; programme?: string }>();
  if (!seanceId || !programme) return <Redirect href={'/(coach)/studio' as Href} />;
  return (
    <EcranSeance
      programmeId={programme}
      seanceId={seanceId}
      onRetour={() =>
        router.canGoBack()
          ? router.back()
          : router.replace(`/(coach)/studio/${encodeURIComponent(programme)}` as Href)
      }
    />
  );
}
