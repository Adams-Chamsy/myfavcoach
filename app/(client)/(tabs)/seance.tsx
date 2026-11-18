import { type Href, useRouter } from 'expo-router';

import { EcranOngletSeance } from '@/fonctionnalites/seance/ecran-onglet-seance';

// Écran 05 (docs/ecrans/L6-05-seance-du-jour.md), l'onglet. Aucune logique ici (CLAUDE.md §5).
export default function Seance() {
  const router = useRouter();
  return (
    <EcranOngletSeance
      onOuvrir={(id) => router.push(`/(client)/seance/${encodeURIComponent(id)}` as Href)}
    />
  );
}
