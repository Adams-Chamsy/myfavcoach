// GÉNÉRÉ — ne pas éditer. Lance npm run tokens.

import {
  font,
  weight,
  texte,
  espace,
  rayon,
  ombre,
  taille,
  mouvement,
  mouvementReduit,
  seuil,
  themes,
} from './tokens';

export type NomFont = keyof typeof font;
export type NomWeight = keyof typeof weight;
export type NomTexte = keyof typeof texte;
export type NomEspace = keyof typeof espace;
export type NomRayon = keyof typeof rayon;
export type NomOmbre = keyof typeof ombre;
export type NomTaille = keyof typeof taille;
export type NomMouvement = keyof typeof mouvement;
export type NomMouvementReduit = keyof typeof mouvementReduit;
export type NomSeuil = keyof typeof seuil;

export type StyleTexte = (typeof texte)[NomTexte];
export type StyleOmbre = (typeof ombre)[NomOmbre];

export type NomTheme = keyof typeof themes;
export type Theme = (typeof themes)['clair'];

export type NomCouleurMarque = keyof Theme['marque'];
export type NomCouleurFond = keyof Theme['fond'];
export type NomCouleurTexte = keyof Theme['texte'];
export type NomCouleurBordure = keyof Theme['bordure'];
export type NomCouleurEtat = keyof Theme['etat'];
export type NomCouleurGris = keyof Theme['gris'];

export type NomCouleur =
  | NomCouleurMarque
  | NomCouleurFond
  | NomCouleurTexte
  | NomCouleurBordure
  | NomCouleurEtat
  | NomCouleurGris;
