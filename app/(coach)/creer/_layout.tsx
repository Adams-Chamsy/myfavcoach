import { Stack } from 'expo-router';

// Layout imbriqué requis pour que "creer" reste UN SEUL ecran du point de vue de la barre
// d'onglets parente (app/(coach)/_layout.tsx), plutot qu'un onglet supplementaire : sans lui,
// Tabs enregistrerait "creer" comme route au meme niveau que pilotage/clients/agenda/revenus.
export default function LayoutCreer() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
