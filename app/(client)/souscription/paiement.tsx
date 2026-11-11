import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform } from 'react-native';

import { EcranPaiement, type ModePaiement } from '@/fonctionnalites/abonnement/ecran-paiement';
import {
  lireIntentionEnCours,
  oublierIntentionEnCours,
} from '@/fonctionnalites/abonnement/intention-en-cours';

// docs/ecrans/L4-04b-recapitulatif-paiement.md (P4.6b), route `souscription/paiement` (nom de la
// fiche). Aucune logique ici (CLAUDE.md §5) : l'écran vit dans src/fonctionnalites/abonnement/.
//
// Deux entrées : depuis 04a (l'intention est en mémoire, intention-en-cours.ts), ou au retour de
// la page de paiement sur web (`?intention={id}`, posé par le serveur, relayé par app/index.tsx).
export default function PaiementEcran() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intention?: string }>();
  const [mode] = useState<ModePaiement | null>(() => {
    if (params.intention) return { type: 'retour', intentionId: params.intention };
    const enCours = lireIntentionEnCours();
    return enCours ? { type: 'recapitulatif', enCours } : null;
  });

  // Ni intention en mémoire ni retour (rechargement, adresse ouverte à la main) : rien à payer ici.
  if (!mode) return <Redirect href={'/(client)/(tabs)/accueil' as Href} />;

  const coachId = mode.type === 'recapitulatif' ? mode.enCours.coach.id : null;
  const versProfil = () => {
    oublierIntentionEnCours();
    router.replace((coachId ? `/(client)/coach/${coachId}` : '/(client)/(tabs)/accueil') as Href);
  };

  return (
    <EcranPaiement
      mode={mode}
      onRetour={() =>
        router.canGoBack()
          ? router.back()
          : router.replace(
              (coachId ? `/(client)/souscription/${coachId}` : '/(client)/(tabs)/accueil') as Href,
            )
      }
      ouvrirPage={async (url) => {
        if (Platform.OS === 'web') {
          // Sur web, la page de paiement remplace l'application dans le même onglet (fiche,
          // « Retour sur web ») : le retour revient par l'adresse posée par le serveur. La
          // promesse ne se résout jamais, la page est quittée.
          window.location.assign(url);
          return new Promise<void>(() => {});
        }
        await WebBrowser.openBrowserAsync(url);
      }}
      // Tant que 04c n'existe pas (P4.7) : retour au profil du coach, sans texte inventé.
      onAbonne={versProfil}
      onRevenirProfil={versProfil}
      onVoirAbonnements={() => {
        oublierIntentionEnCours();
        router.replace('/(client)/(tabs)/moi' as Href);
      }}
      onRienAConstater={() => {
        oublierIntentionEnCours();
        router.replace('/(client)/(tabs)/accueil' as Href);
      }}
      onOuvrirConditions={() => router.push('/(public)/documents/cgv' as Href)}
    />
  );
}
