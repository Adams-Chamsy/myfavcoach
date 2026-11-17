import { type Href, useRouter } from 'expo-router';

import { EcranFactures } from '@/fonctionnalites/factures/ecran-factures';

// docs/ecrans/L5-C05-factures-recus.md, la liste. Aucune logique ici (CLAUDE.md §5).
export default function FacturesEcran() {
  const router = useRouter();
  return (
    <EcranFactures
      onRetour={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
      onOuvrirFacture={(id) => router.push(`/(compte)/factures/${encodeURIComponent(id)}` as Href)}
    />
  );
}
