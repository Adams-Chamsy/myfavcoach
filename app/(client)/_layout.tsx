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
      {/* coach/[id] (L2-12/13/14, atteint depuis accueil et explorer, P3.4/P3.5) : pas un
          onglet, href:null comme creer/moi dans (coach)/_layout.tsx. Cette déclaration seule NE
          RÉSOUT PAS le défaut trouvé par src/test/routage/cache-recherche-retour-profil.test.tsx
          (P3.4-P3.6, docs/dette.md) : un push vers coach/[id] depuis un onglet remplace quand
          même l'entrée de l'onglet actif dans l'historique de ce Tabs (expo-router/js-tabs) —
          celui-ci ne retient que deux emplacements (le tout premier onglet visité et l'entrée
          courante), pas une vraie pile. Retour arrière = premier onglet (Accueil), jamais
          l'onglet quitté. La vraie correction (Tabs enveloppé dans un Stack, coach/[id] en frère
          du groupe de Tabs plutôt qu'un de ses écrans) reste à faire — voir docs/dette.md. */}
      <Tabs.Screen name="coach/[id]" options={{ href: null }} />
    </Tabs>
  );
}
