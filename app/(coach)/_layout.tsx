import { Stack } from 'expo-router';

// Restructuré le 13 septembre 2026 (src/test/routage/cache-navigation-creer-coach.test.tsx,
// docs/dette.md), même correction que app/(client)/_layout.tsx : ce groupe portait directement
// le Tabs (expo-router/js-tabs) des quatre onglets ET creer/, au même niveau — Tabs ne conserve
// que deux emplacements dans son historique interne, jamais une vraie pile, donc un push vers
// creer/[type] depuis un onglet (Clients, Agenda, Revenus) remplaçait l'onglet actif au lieu de
// s'empiler dessus ; le retour arrière atterrissait sur Pilotage (le premier onglet), jamais sur
// l'onglet quitté.
//
// Les quatre onglets (et moi, hors périmètre de cette correction — voir son commentaire dans
// (tabs)/_layout.tsx) vivent maintenant dans (tabs)/_layout.tsx ; creer/ reste ici, en écran
// FRÈRE du groupe (tabs) dans ce Stack — un push vers creer/[type] s'empile donc par-dessus
// l'ENTIER groupe de Tabs sans jamais le traverser, et un retour arrière le retrouve intact,
// quel que soit l'onglet qui était actif.
export default function LayoutCoach() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
