import { Stack } from 'expo-router';

// Restructuré le 13 septembre 2026 (src/test/routage/cache-recherche-retour-profil.test.tsx,
// docs/dette.md) : ce groupe portait directement le Tabs (expo-router/js-tabs) des cinq onglets
// ET coach/[id], toutes deux au même niveau — Tabs ne conserve que deux emplacements dans son
// historique interne (le tout premier onglet visité et l'entrée courante), jamais une vraie
// pile, donc un push vers coach/[id] depuis un onglet remplaçait l'onglet actif au lieu de
// s'empiler dessus ; le retour arrière atterrissait sur le premier onglet, jamais sur l'onglet
// quitté.
//
// Les cinq onglets vivent maintenant dans (tabs)/_layout.tsx (groupe invisible dans l'URL,
// aucun `/(tabs)/` n'apparaît jamais dans une route) ; coach/[id] reste ici, en écran FRÈRE du
// groupe (tabs) dans ce Stack — un push vers coach/[id] s'empile donc par-dessus l'ENTIER groupe
// de Tabs sans jamais le traverser, et un retour arrière le retrouve intact, quel que soit
// l'onglet qui était actif. Même correction appliquée à app/(coach)/_layout.tsx (creer/[type]).
export default function LayoutClient() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
