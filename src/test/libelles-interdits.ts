// docs/domaine.md §2, règle des magasins d'applications : dans le tunnel (04a, 04b, 04c, 20) et
// partout où l'on parle de ce que le client achète, aucune formulation qui vende de l'accès à du
// contenu. LA liste unique du dépôt (docs/prompts/L4.md point 11) : chaque écran du tunnel la
// passe par libellesInterditsTrouves, aucun écran n'en tient une copie.
//
// Un motif par terme, insensible à la casse, qui attrape aussi ses formes fléchies (« Débloque »,
// « illimitée », « exclusive »). Un test attrape un mot, pas une tournure : la relecture humaine
// de chaque texte du tunnel reste due (docs/domaine.md §2).
export const LIBELLES_INTERDITS: { terme: string; motif: RegExp }[] = [
  { terme: 'débloquer', motif: /d[ée]bloqu/i },
  { terme: 'déverrouiller', motif: /d[ée]verrouill/i },
  { terme: 'premium', motif: /premium/i },
  { terme: 'illimité', motif: /illimit/i },
  { terme: 'exclusif', motif: /exclusi(f|ve|vit)/i },
  { terme: 'accès au contenu', motif: /acc[èe]s au contenu/i },
  { terme: 'accéder au contenu', motif: /acc[ée]der au contenu/i },
  { terme: 'bibliothèque', motif: /biblioth[èe]que/i },
  { terme: 'VIP', motif: /\bvip\b/i },
  { terme: 'version complète', motif: /version compl[èe]te/i },
];

// L'arbre que rend @testing-library/react-native v14 (`screen.container`) : uniquement des
// composants natifs (« hôtes »), dont les enfants sont d'autres hôtes ou du texte brut. Type écrit
// ici, au plus juste, plutôt qu'importé de la bibliothèque de rendu sous-jacente (test-renderer),
// dont ce dépôt ne dépend pas directement.
export type NoeudHote = {
  type: string;
  props: Record<string, unknown>;
  children: (NoeudHote | string)[];
  queryAll(predicat: (n: NoeudHote) => boolean): NoeudHote[];
};

// Ce qu'une personne lit ou entend : le texte de chaque composant Text natif rendu, et les
// libellés et indices d'accessibilité de chaque composant natif. Jamais la sérialisation brute
// de l'arbre (un nom de propriété ou un identifiant de test n'est lu par personne).
export function textesLisibles(racine: NoeudHote): string[] {
  return racine
    .queryAll(() => true)
    .flatMap((n) => {
      const textes =
        n.type === 'Text'
          ? [n.children.filter((e): e is string => typeof e === 'string').join('')].filter(Boolean)
          : [];
      const accessibles = [n.props.accessibilityLabel, n.props.accessibilityHint].filter(
        (t): t is string => typeof t === 'string',
      );
      return [...textes, ...accessibles];
    });
}

// Rend la liste des termes trouvés, chacun avec le texte qui le porte : vide si rien n'est trouvé.
export function libellesInterditsTrouves(racine: NoeudHote): string[] {
  const textes = textesLisibles(racine);
  return LIBELLES_INTERDITS.flatMap(({ terme, motif }) =>
    textes.filter((t) => motif.test(t)).map((t) => `${terme} : « ${t} »`),
  );
}
