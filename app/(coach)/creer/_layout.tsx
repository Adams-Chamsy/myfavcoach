// Stack de `expo-router/js-stack`, pas le Stack natif (12 novembre 2026, A3) : l'écran d'offre
// monte la garde de sortie (useGardeSortie), dont `usePreventRemove` n'intercepte pas le geste de
// retour natif d'iOS sur une pile native — même choix que app/(compte)/_layout.tsx.
import { Stack } from 'expo-router/js-stack';

// Layout imbriqué requis pour que "creer" reste UN SEUL ecran du point de vue de la barre
// d'onglets parente (app/(coach)/_layout.tsx), plutot qu'un onglet supplementaire : sans lui,
// Tabs enregistrerait "creer" comme route au meme niveau que pilotage/clients/agenda/revenus.
export default function LayoutCreer() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
