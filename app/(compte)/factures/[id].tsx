import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { EcranFacture } from '@/fonctionnalites/factures/ecran-facture';

// docs/ecrans/L5-C05-factures-recus.md, une facture. L'identifiant vient de l'adresse : le
// serveur décide si elle concerne le compte connecté (ma_facture, 0075).
export default function FactureEcran() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) return <Redirect href={'/(compte)/factures' as Href} />;
  return (
    <EcranFacture
      factureId={id}
      onRetour={() =>
        router.canGoBack() ? router.back() : router.replace('/(compte)/factures' as Href)
      }
    />
  );
}
