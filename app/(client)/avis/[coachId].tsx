import { type Href, Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { EcranDepotAvis } from '@/fonctionnalites/avis/ecran-depot-avis';

// docs/ecrans/L4-27a-depot-avis.md (P4.9b), route `avis/[coachId]` (nom de la fiche). Aucune
// logique ici (CLAUDE.md §5) : l'écran vit dans src/fonctionnalites/avis/.
//
// Atteint par « Donner mon avis » (ou « Modifier mon avis ») de l'onglet Avis du profil : le
// profil est derrière, on y revient. Ouvert par son adresse, rien n'est derrière : le profil
// remplace alors cet écran. Le serveur décide si ce lecteur peut déposer un avis.
export default function DepotAvisEcran() {
  const router = useRouter();
  const { coachId } = useLocalSearchParams<{ coachId?: string }>();
  if (!coachId) return <Redirect href={'/(client)/(tabs)/accueil' as Href} />;
  const profil = `/(client)/coach/${encodeURIComponent(coachId)}` as Href;
  const versProfil = () => (router.canGoBack() ? router.back() : router.replace(profil));
  return (
    <EcranDepotAvis
      coachId={coachId}
      onRetour={versProfil}
      onEnregistre={versProfil}
      onRienADeposer={() => router.replace(profil)}
    />
  );
}
