import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { EcranProgrammes } from '@/fonctionnalites/studio/ecran-programmes';

// docs/ecrans/L6-11-studio.md, « Mes programmes ». `?pour=seance` : arrivé par « Nouvelle séance »
// de la feuille Créer ; `?nouveau=1` : par « Nouveau programme ». Aucune logique ici (CLAUDE.md §5).
export default function StudioEcran() {
  const router = useRouter();
  const { pour, nouveau } = useLocalSearchParams<{ pour?: string; nouveau?: string }>();
  return (
    <EcranProgrammes
      choixPourSeance={pour === 'seance'}
      creerAuMontage={nouveau === '1'}
      onRetour={() =>
        router.canGoBack() ? router.back() : router.replace('/(coach)/(tabs)/pilotage' as Href)
      }
      onOuvrirProgramme={(id) => router.push(`/(coach)/studio/${encodeURIComponent(id)}` as Href)}
      onOuvrirBibliotheque={() => router.push('/(coach)/studio/bibliotheque' as Href)}
    />
  );
}
