import type { ReactElement } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CorpsExplorer } from '@/fonctionnalites/decouverte/ecran-recherche';

export { CorpsExplorer } from '@/fonctionnalites/decouverte/ecran-recherche';

export default function Explorer(): ReactElement {
  const params = useLocalSearchParams<{ discipline?: string }>();
  return <CorpsExplorer disciplinePreselectionnee={params.discipline} />;
}
