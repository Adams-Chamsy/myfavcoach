import { Stack } from 'expo-router/js-stack';

// Les trois destinations des trois lignes de l'écran compte (docs/ecrans/L1-09-mes-informations.md).
// Pile simple : chaque écran est empilé depuis « Moi » (dans l'un ou l'autre espace) et revient
// par le geste retour. Pas de garde de groupe — comme (client)/(coach), l'accès est déjà
// gouverné par la redirection de app/index.tsx et de (public)/_layout.tsx.
//
// Stack de `expo-router/js-stack`, pas le Stack natif par défaut : « Mes informations » pose une
// garde de sortie (useGardeSortie, src/fonctionnalites/navigation/garde-sortie.tsx) qui repose
// sur `beforeRemove`, « not fully supported in native-stack » d'après l'avertissement du paquet.
// Même famille que `expo-router/js-tabs`, déjà utilisé par les deux coquilles.
export default function LayoutCompte() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
