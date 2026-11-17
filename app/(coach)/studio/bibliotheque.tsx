import { type Href, useRouter } from 'expo-router';

import { EcranBibliotheque } from '@/fonctionnalites/studio/ecran-bibliotheque';

// docs/ecrans/L6-11-studio.md, « Bibliothèque ».
export default function BibliothequeEcran() {
  const router = useRouter();
  return (
    <EcranBibliotheque
      onRetour={() =>
        router.canGoBack() ? router.back() : router.replace('/(coach)/studio' as Href)
      }
    />
  );
}
