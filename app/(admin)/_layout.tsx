import { Stack } from 'expo-router';

// L2-10 : groupe distinct, JAMAIS lié depuis la navigation mobile ((client)/(coach)/(compte)/
// (public)/(onboarding)) — voir src/test/aucun-lien-vers-admin.test.ts. Pas de protection de
// route ici au-delà de la non-atteignabilité : le vrai verrou est côté serveur
// (est_examinateur_courant(), docs/backend.md §9), jamais côté client.
export default function LayoutAdmin() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
