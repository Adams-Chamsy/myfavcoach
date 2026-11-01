import { useState } from 'react';
import { usePreventRemove } from 'expo-router/react-navigation';

// Première interception de navigation du dépôt (docs/prompts/L1.md, P1.13b). S'appuie sur
// `usePreventRemove` de React Navigation (embarqué par expo-router, `expo-router/react-navigation`).
// Jusqu'au SDK 57, c'était l'événement `beforeRemove` via `useNavigation().addListener` : le SDK
// 58 l'a SUPPRIMÉ, et l'ancien code écoutait silencieusement un événement qui n'arrivait plus —
// la sortie passait sans confirmation (trouvé le 1er novembre 2026 par
// src/test/routage/garde-sortie-informations.test.tsx et par tsc, docs/prompts/SDK58.md).
// Réutilisée telle quelle par L5 (édition d'offre) et L8 (rédaction de message).
//
// PÉRIMÈTRE — ne couvre que les sorties « retour » : chevron, geste iOS, retour matériel
// Android, `router.back()`. Ne se déclenche PAS quand le groupe est démonté par le haut
// (bascule d'espace, lien profond, notification, déconnexion : `router.replace` au niveau
// `_layout` ou `FeuilleBascule`) — `beforeRemove` n'est pas émis au démontage d'un ancêtre.
// Pour un écran sans navigation interne (ex. `app/(compte)/informations.tsx`), les seules
// sorties réelles SONT des « retour » : le tableau est alors complet. Le résidu (lien profond
// reçu pendant l'édition) est au niveau application et vaut pour tout écran — voir
// `docs/dette.md`.
//
// REQUIERT un `Stack` de `expo-router/js-stack`. Le `Stack` par défaut (native-stack) émet un
// avertissement explicite : `beforeRemove` « is not fully supported in native-stack ». Voir
// `app/(compte)/_layout.tsx`.
export type SortieEnAttente = { reprendre: () => void } | null;

export function useGardeSortie(actif: boolean): {
  sortieEnAttente: SortieEnAttente;
  annulerSortie: () => void;
} {
  const [sortieEnAttente, setSortieEnAttente] = useState<SortieEnAttente>(null);
  // Une fois la sortie confirmée, la prévention est levée dans le même geste que `repeat()`, qui
  // rejoue l'action bloquée : c'est la forme documentée de usePreventRemove. L'écran se démonte
  // juste après, la valeur n'a pas à revenir à false.
  const [sortieAutorisee, setSortieAutorisee] = useState(false);

  usePreventRemove(actif && !sortieAutorisee, ({ repeat }) => {
    setSortieEnAttente({
      reprendre: () => {
        setSortieAutorisee(true);
        setSortieEnAttente(null);
        repeat();
      },
    });
  });

  return {
    sortieEnAttente,
    annulerSortie: () => setSortieEnAttente(null),
  };
}
