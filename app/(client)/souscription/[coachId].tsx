import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { EcranChoixOffre } from '@/fonctionnalites/abonnement/ecran-choix-offre';
import { poserIntentionEnCours } from '@/fonctionnalites/abonnement/intention-en-cours';

// docs/ecrans/L4-04a-choix-offre.md, route `souscription/[coachId]` (nom de la fiche). Aucune
// logique ici (CLAUDE.md §5) : l'écran vit dans src/fonctionnalites/abonnement/.
export default function ChoixOffreEcran() {
  const { coachId } = useLocalSearchParams<{ coachId: string }>();
  const router = useRouter();
  if (!coachId) return null;
  return (
    <EcranChoixOffre
      coachId={coachId}
      // Atteint par un push depuis le profil (cas normal) : retour arrière. Ouvert directement
      // par son adresse (web), rien derrière : le profil du coach, jamais un retour dans le vide.
      onRetour={() =>
        router.canGoBack() ? router.back() : router.replace(`/(client)/coach/${coachId}` as Href)
      }
      // P4.6b : l'intention part vers 04b en mémoire (intention-en-cours.ts), jamais dans la
      // route : l'URL de paiement n'entre ni dans une adresse ni dans un stockage (CLAUDE.md §10).
      onIntentionCreee={(intention, choix) => {
        poserIntentionEnCours({ intention, ...choix, creeeLe: Date.now() });
        router.push('/(client)/souscription/paiement' as Href);
      }}
    />
  );
}
