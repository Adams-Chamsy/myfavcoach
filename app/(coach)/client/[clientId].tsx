import { useLocalSearchParams } from 'expo-router';

import { EcranFicheClient } from '@/fonctionnalites/suivi/fiche-client';

export default function FicheClient() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  return <EcranFicheClient key={clientId} clientId={clientId} />;
}
