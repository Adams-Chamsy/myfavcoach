import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  espace,
  mouvement,
  mouvementReduit,
  ombre,
  rayon,
  seuil,
  taille,
  texte,
  themes,
} from './tokens';
import type { NomTheme, Theme } from './types';

// Regroupe les couleurs du theme actif (marque, fond, texte, bordure, etat, gris) sous
// "couleur" pour ne jamais entrer en collision avec "texte" ci-dessous, qui designe les
// styles de typographie (texte.display, texte.corps...) : les deux s'appellent "texte"
// dans design/tokens.json mais ne contiennent pas la meme chose.
export type ThemeResolu = {
  couleur: Theme;
  texte: typeof texte;
  espace: typeof espace;
  rayon: typeof rayon;
  ombre: typeof ombre;
  taille: typeof taille;
  seuil: typeof seuil;
};

const ContexteTheme = createContext<ThemeResolu | null>(null);

type ProprietesFournisseurTheme = {
  children: ReactNode;
  // Reserve a la galerie de developpement (app/_galerie.tsx), pour previsualiser le sombre.
  // Ne jamais lire ce theme depuis le systeme ici : voir le commentaire plus bas.
  themeForce?: Extract<NomTheme, 'clair' | 'sombre'>;
};

export function FournisseurTheme({ children, themeForce }: ProprietesFournisseurTheme) {
  // Jalon 1 : le theme est FORCE EN CLAIR. useColorScheme n'est jamais lu ici, meme si
  // les tokens du sombre existent (design/tokens.json). Le sombre n'est pas concu ecran
  // par ecran et n'est pas livre au jalon 1 : voir docs/perimetre.md SS3 ("Mode sombre").
  // Ne "corrige" pas cette ligne pour suivre le systeme : ce sera fait au lot ou le mode
  // sombre sera reellement livre, pas avant. "themeForce" existe uniquement pour que la
  // galerie de developpement previsualise le sombre sans que l'app y bascule toute seule.
  const nomTheme: NomTheme = themeForce ?? 'clair';

  const valeur = useMemo<ThemeResolu>(
    () => ({
      couleur: themes[nomTheme],
      texte,
      espace,
      rayon,
      ombre,
      taille,
      seuil,
    }),
    [nomTheme],
  );

  return <ContexteTheme.Provider value={valeur}>{children}</ContexteTheme.Provider>;
}

export function useTheme(): ThemeResolu {
  const contexte = useContext(ContexteTheme);
  if (!contexte) {
    throw new Error("useTheme doit etre appele a l'interieur de <FournisseurTheme>.");
  }
  return contexte;
}

// Durees de mouvement.courbe a mouvement.voileOpacite, avec les valeurs de mouvementReduit
// substituees quand le reglage systeme "mouvement reduit" est actif. "voile" et
// "voileOpacite" ne sont pas dans mouvementReduit (design/tokens.json) : ce sont des
// opacites, conservees telles quelles, jamais mises a zero.
//
// Types elargis en number/string (pas les litteraux exacts de "mouvement") : la version
// mouvement reduit remplace 120 par 0, 320 par 150... des valeurs differentes, donc pas
// assignables aux litteraux de "mouvement" sans cet elargissement.
type ElargirValeur<Valeur> = Valeur extends string ? string : number;
export type DureesMouvement = {
  [Cle in keyof typeof mouvement]: ElargirValeur<(typeof mouvement)[Cle]>;
} & { actif: boolean };

// Seul point de lecture de AccessibilityInfo.isReduceMotionEnabled du projet : voir
// docs/design-system.md SS4 ("un seul hook useMouvementReduit() — jamais en double").
export function useMouvementReduit(): DureesMouvement {
  const [actif, setActif] = useState(false);

  useEffect(() => {
    let monte = true;

    AccessibilityInfo.isReduceMotionEnabled().then((valeurInitiale) => {
      if (monte) setActif(valeurInitiale);
    });

    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', setActif);

    return () => {
      monte = false;
      abonnement.remove();
    };
  }, []);

  return useMemo(
    () => (actif ? { ...mouvement, ...mouvementReduit, actif } : { ...mouvement, actif }),
    [actif],
  );
}
