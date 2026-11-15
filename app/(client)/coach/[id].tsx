import type { ReactElement } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CorpsProfilCoachPublic } from '@/fonctionnalites/decouverte/ecran-profil-coach';
export { CorpsProfilCoachPublic } from '@/fonctionnalites/decouverte/ecran-profil-coach';
export default function ProfilCoachPublicEcran(): ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CorpsProfilCoachPublic id={id} />;
}
