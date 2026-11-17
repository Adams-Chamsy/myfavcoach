import { type Href, useRouter } from 'expo-router';

import { EcranFacturation } from '@/fonctionnalites/revenus/ecran-facturation';

// docs/ecrans/L5-13-revenus.md, « Formulaire — informations de facturation ». Aucune logique ici.
export default function FacturationEcran() {
  const router = useRouter();
  const versRevenus = () =>
    router.canGoBack() ? router.back() : router.replace('/(coach)/(tabs)/revenus' as Href);
  return <EcranFacturation onRetour={versRevenus} onEnregistre={versRevenus} />;
}
