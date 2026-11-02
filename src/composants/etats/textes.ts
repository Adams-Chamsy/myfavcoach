// Textes de repli de EtatErreur — docs/ecrans/L0-03-etats-systeme.md, section "Textes de
// repli". Les seuls autorisés : aucun ecran du produit n'ecrit son propre message d'erreur.
// Utilises quand le serveur n'en fournit pas (docs/api.md §1).

export type SituationErreur =
  'reseauAbsent' | 'serveur' | 'delaiDepasse' | 'nonAutorise' | 'introuvable';

export type TexteRepli = {
  titre: string;
  explication: string;
};

export const textesRepliErreur: Record<SituationErreur, TexteRepli> = {
  reseauAbsent: {
    titre: 'Pas de connexion',
    explication: "Vérifie ton réseau, on réessaie dès que c'est revenu.",
  },
  serveur: {
    titre: 'On a un souci de notre côté',
    // Formulation unique, validée le 1er novembre 2026 (même texte que le repli des Edge Functions,
    // supabase/functions/_partage/refus.ts) : « On réessaie » promettait un nouvel essai
    // automatique qui n'existe pas.
    explication: "Ce n'est pas toi. Réessaie dans un instant.",
  },
  delaiDepasse: {
    titre: 'Ça met plus de temps que prévu',
    explication: 'La connexion est lente, ou on rame un peu.',
  },
  nonAutorise: {
    titre: "Tu n'as pas accès à cette page",
    explication: 'Elle appartient peut-être à ton autre espace.',
  },
  introuvable: {
    titre: "Cette page n'existe plus",
    explication: 'Elle a peut-être été supprimée.',
  },
};
