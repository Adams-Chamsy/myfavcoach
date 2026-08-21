import type { ReactNode } from 'react';
import Svg from 'react-native-svg';

import { useTheme } from '@/theme/fournisseur';
import { taille as tailleTokens } from '@/theme/tokens';

// Props communes aux 36 icones : primitives pures, aucune ne connait le theme.
export type ProprietesIcone = {
  taille?: number;
  couleur?: string;
  actif?: boolean;
};

type ProprietesIconeBase = ProprietesIcone & {
  children: ReactNode;
  // Seule "note" (etoile de notation) est pleine — docs/design-system.md §5. Jamais expose
  // aux consommateurs : c'est une propriete intrinseque de l'icone, pas un choix d'appel.
  plein?: boolean;
};

// Seul point de src/composants/icones/ qui connait le theme : "currentColor" n'existe pas
// en React Native (pas de cascade CSS), donc l'icone ne peut pas simplement "heriter" une
// couleur ambiante. Sans couleur explicite, IconeBase lit theme.couleur.texte.principal via
// useTheme — c'est pour ca que <FournisseurTheme> doit englober tout composant qui rend une
// icone sans passer "couleur". Les 36 fichiers d'icones, eux, restent des tracés purs :
// aucun n'importe useTheme.
export function IconeBase({
  taille = tailleTokens.icone,
  couleur,
  actif = false,
  plein = false,
  children,
}: ProprietesIconeBase) {
  const theme = useTheme();
  const couleurResolue = couleur ?? theme.couleur.texte.principal;

  return (
    <Svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill={plein ? couleurResolue : 'none'}
      stroke={plein ? 'none' : couleurResolue}
      strokeWidth={actif ? tailleTokens.iconeTraitActif : tailleTokens.iconeTrait}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}
