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
//
// Ce groupe (tabs) ne contient QUE les cinq vrais onglets — coach/[id] vit un niveau au-dessus
// (app/(client)/_layout.tsx), en écran frère de ce groupe, jamais parmi ces Tabs.Screen. Raison
// structurelle, pas de goût : l'historique interne d'un Tabs (expo-router/js-tabs) ne retient
// que deux emplacements (le tout premier onglet visité et l'entrée courante), jamais une vraie
// pile — un troisième saut, DANS ce Tabs, quel qu'il soit (déclaré ou href:null), fait perdre
// l'entrée du milieu. Un onglet réel qui en remplace un autre par un appui dans la barre n'a pas
// besoin d'un "retour" qui le retrouve précisément (aucune app de ce genre ne le promet) ; un
// écran de détail comme coach/[id], poussé DEPUIS un onglet, en a besoin — d'où sa sortie de ce
// groupe. Trouvé et vérifié par src/test/routage/cache-recherche-retour-profil.test.tsx.
export default function LayoutTabsClient() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BarreOngletsRoute variante="client" entrees={ONGLETS} {...props} />}
    >
      <Tabs.Screen name="accueil" />
      <Tabs.Screen name="explorer" />
      <Tabs.Screen name="seance" />
      <Tabs.Screen name="messages" />
      {/* moi : un vrai onglet (barre du bas), doit rester un Tabs.Screen pour que
          BarreOngletsRoute le retrouve. feuille-bascule.tsx le pousse AUSSI par router.push
          depuis n'importe quel autre onglet (avatar → "Mon compte") : ce push-là garde la même
          limite que coach/[id] avant sa sortie de ce groupe (retour arrière = Accueil, jamais
          l'onglet quitté) — hors du périmètre demandé pour cette correction, à signaler. */}
      <Tabs.Screen name="moi" />
    </Tabs>
  );
}
