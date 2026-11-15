import type { ImageSourcePropType } from 'react-native';

import rencontre from '../../../assets/accueil/rencontre-sportive.jpg';
import effort from '../../../assets/accueil/effort-accompagne.jpg';
import progression from '../../../assets/accueil/progression-personnelle.jpg';

export type EtapePresentation = {
  titre: string;
  texte: string;
  image: ImageSourcePropType;
  alternative: string;
  cadrageVertical: number;
};

// Textes validés le 15 novembre 2026. Les photos sont des ambiances sportives ; elles
// n'identifient aucun coach du catalogue et ne limitent pas les disciplines de la recherche.
export const etapesPresentation: readonly EtapePresentation[] = [
  {
    titre: 'Trouve ton coach.',
    texte: 'Explore les profils selon ton objectif, ton rythme et ton budget.',
    image: rencontre,
    alternative:
      'Une coach échange avec un sportif aux cheveux grisonnants avant une séance en extérieur.',
    cadrageVertical: 0.14,
  },
  {
    titre: 'Compare les offres.',
    texte: 'Regarde le prix, ce qui est inclus et l’engagement humain du coach.',
    image: effort,
    alternative:
      'Une sportive réalise un exercice au poids du corps sous le regard attentif de son coach.',
    cadrageVertical: 0.42,
  },
  {
    titre: 'Choisis ton accompagnement.',
    texte: 'Crée ton compte quand tu es prêt, puis choisis l’offre qui te correspond.',
    image: progression,
    alternative:
      'Une sportive apprécie son effort après une montée d’escaliers dans un parc, son coach à ses côtés.',
    cadrageVertical: 0.42,
  },
];
