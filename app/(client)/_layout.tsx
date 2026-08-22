import { Tabs } from 'expo-router/js-tabs';

import { BarreOngletsRoute, type EntreeOnglet } from '@/fonctionnalites/navigation/barre-onglets';

// Ordre et libelles de docs/ecrans/L0-01-coquille-client.md.
const ONGLETS: EntreeOnglet[] = [
  { nomRoute: 'accueil', icone: 'accueil', libelle: 'Accueil' },
  { nomRoute: 'explorer', icone: 'recherche', libelle: 'Explorer' },
  { nomRoute: 'seance', icone: 'seance', libelle: 'Séance' },
  { nomRoute: 'messages', icone: 'message', libelle: 'Messages' },
  { nomRoute: 'moi', icone: 'profil', libelle: 'Moi' },
];

// docs/ecrans/L0-01-coquille-client.md. La bascule vers l'espace coach n'existe pas encore
// (elle arrive en L1, par l'avatar de "Moi") : ne pas la preparer ici.
export default function LayoutClient() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BarreOngletsRoute variante="client" entrees={ONGLETS} {...props} />}
    >
      <Tabs.Screen name="accueil" />
      <Tabs.Screen name="explorer" />
      <Tabs.Screen name="seance" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="moi" />
    </Tabs>
  );
}
