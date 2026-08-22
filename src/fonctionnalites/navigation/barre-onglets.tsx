import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { BarreNavigation, type ElementNavigation } from '@/composants/barre-navigation';
import type { NomIcone } from '@/composants/icones';

export type EntreeOnglet = {
  nomRoute: string;
  icone: NomIcone;
  libelle: string;
  pastilleNonLus?: number;
};

export type ActionCentrale = {
  // Index dans la liste finale (apres insertion), pas dans "entrees" seul.
  position: number;
  icone: NomIcone;
  libelle: string;
  onPress: () => void;
};

export type ProprietesBarreOngletsRoute = BottomTabBarProps & {
  variante: 'client' | 'coach';
  entrees: EntreeOnglet[];
  // Action non routee, jamais un onglet (docs/ecrans/L0-02-coquille-coach.md, critere 2) :
  // ouvre par exemple une feuille basse plutot que de naviguer.
  actionCentrale?: ActionCentrale;
};

// Traduit l'etat de navigation d'expo-router (Tabs) vers la primitive BarreNavigation
// (src/composants/barre-navigation.tsx), en reproduisant le comportement standard de React
// Navigation pour un tabBar personnalise : appuyer sur l'onglet deja actif emet "tabPress"
// plutot que de re-naviguer, ce qui permet a un futur ecran scrollable de remonter en haut
// (docs/ecrans/L0-01-coquille-client.md — sans effet tant que les ecrans sont provisoires).
//
// Parcourt "entrees" (la liste voulue), pas "state.routes" (tout ce que Tabs a enregistre) :
// un groupe app/(coach)/ peut contenir des routes qui ne sont pas des onglets (ex. creer/, une
// pile imbriquee ouverte par une feuille basse, marquee href:null cote Tabs.Screen) — ce ne
// sont pas des typos a signaler, juste des routes que cette barre ignore.
export function BarreOngletsRoute({
  variante,
  entrees,
  actionCentrale,
  state,
  navigation,
  insets,
}: ProprietesBarreOngletsRoute) {
  const elements: ElementNavigation[] = entrees.map((entree) => {
    const index = state.routes.findIndex((route) => route.name === entree.nomRoute);
    if (index === -1) {
      throw new Error(`Route "${entree.nomRoute}" absente de la barre : verifie ONGLETS.`);
    }
    const route = state.routes[index];
    const estActif = state.index === index;

    return {
      icone: entree.icone,
      libelle: entree.libelle,
      actif: estActif,
      pastilleNonLus: entree.pastilleNonLus,
      onPress: () => {
        const evenement = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!estActif && !evenement.defaultPrevented) {
          navigation.navigate(route.name);
        }
      },
    };
  });

  if (actionCentrale) {
    elements.splice(actionCentrale.position, 0, {
      icone: actionCentrale.icone,
      libelle: actionCentrale.libelle,
      misEnAvant: true,
      onPress: actionCentrale.onPress,
    });
  }

  return <BarreNavigation variante={variante} elements={elements} paddingBas={insets.bottom} />;
}
