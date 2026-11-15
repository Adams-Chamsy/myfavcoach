import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { EcranConfirmation } from '@/fonctionnalites/abonnement/ecran-confirmation';

// docs/ecrans/L4-04c-confirmation-abonnement.md (P4.7), route `souscription/confirmation` (nom de
// la fiche). Aucune logique ici (CLAUDE.md §5) : l'écran vit dans src/fonctionnalites/abonnement/.
//
// Atteint depuis 04b, après un constat `abonne` : 04b a d'abord ramené la pile au profil du coach
// (dismissTo), puis empilé cet écran — 04a et 04b ne sont plus derrière, un retour ramène au
// profil (fiche, « Pas de retour vers le paiement » ; src/test/routage/tunnel-confirmation-pile).
// L'identifiant vient de l'adresse : le serveur décide s'il appartient au compte connecté.
export default function ConfirmationEcran() {
  const router = useRouter();
  const { abonnement } = useLocalSearchParams<{ abonnement?: string }>();
  if (!abonnement) return <Redirect href={'/(client)/(tabs)/accueil' as Href} />;
  return (
    <EcranConfirmation
      abonnementId={abonnement}
      // dismissTo : revient au profil s'il est derrière (cas normal, la pile se vide jusqu'à lui),
      // le pousse sinon (retour web, où rien n'est derrière, ou adresse ouverte à la main) —
      // jamais un retour vers un autre écran (mesuré à la clôture : canGoBack() était vrai avec
      // les onglets derrière, et « Voir le profil » ramenait à l'accueil).
      onVoirProfil={(coachId) => router.dismissTo(`/(client)/coach/${coachId}` as Href)}
    />
  );
}
