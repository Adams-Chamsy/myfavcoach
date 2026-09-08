import { Stack } from 'expo-router';

// Les trois destinations des trois lignes de l'écran compte (docs/ecrans/L1-09-mes-informations.md).
// Pile simple : chaque écran est empilé depuis « Moi » (dans l'un ou l'autre espace) et revient
// par le geste retour. Pas de garde de groupe — comme (client)/(coach), l'accès est déjà
// gouverné par la redirection de app/index.tsx et de (public)/_layout.tsx.
export default function LayoutCompte() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
