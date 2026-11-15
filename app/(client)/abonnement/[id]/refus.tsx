import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { EcranPaiementRefuse } from '@/fonctionnalites/abonnement/ecran-paiement-refuse';

// docs/ecrans/L4-20-paiement-refuse.md (P4.7), route `abonnement/[id]/refus` (nom de la fiche).
// Aucune logique ici (CLAUDE.md §5) : l'écran vit dans src/fonctionnalites/abonnement/.
//
// Deux entrées : « Régler » dans « Mes abonnements » (24b), ou le retour de la page du prestataire
// sur web (`/?moyen={id}`, posé par le serveur, relayé par app/index.tsx avec `retour=1`).
// L'identifiant vient de l'adresse : le serveur décide s'il appartient au compte connecté.
const COMPTE = '/(client)/(tabs)/moi' as Href;

export default function PaiementRefuseEcran() {
  const router = useRouter();
  const { id, retour } = useLocalSearchParams<{ id?: string; retour?: string }>();
  if (!id) return <Redirect href={COMPTE} />;
  return (
    <EcranPaiementRefuse
      abonnementId={id}
      auRetourDeLaPage={retour === '1'}
      // Retour vers l'écran compte (fiche, Contenu) : il est derrière quand on vient de 24b ;
      // rien n'est derrière au retour web, il remplace alors cet écran.
      onRetour={() => (router.canGoBack() ? router.back() : router.replace(COMPTE))}
      onRienARegler={() => router.replace(COMPTE)}
      ouvrirPage={async (url) => {
        if (Platform.OS === 'web') {
          // Sur web, la page du prestataire remplace l'application dans le même onglet, comme en
          // 04b : la promesse ne se résout jamais, la page est quittée.
          window.location.assign(url);
          return new Promise<void>(() => {});
        }
        await WebBrowser.openBrowserAsync(url);
      }}
    />
  );
}
