import { useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';

// Première interception de navigation du dépôt (docs/prompts/L1.md, P1.13b). S'appuie sur
// l'événement `beforeRemove` de React Navigation, atteint via `useNavigation()` d'expo-router.
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
  const navigation = useNavigation();
  const [sortieEnAttente, setSortieEnAttente] = useState<SortieEnAttente>(null);
  // Une fois la sortie confirmée, on relance la MÊME action de navigation ; sans ce drapeau,
  // le listener la ré-intercepterait et la boucle serait infinie. L'écran se démonte juste
  // après, la valeur n'a pas à être remise à false.
  const sortieAutorisee = useRef(false);

  useEffect(() => {
    if (!actif) return;

    const retirer = navigation.addListener('beforeRemove', (evenement) => {
      if (sortieAutorisee.current) return;
      evenement.preventDefault();
      setSortieEnAttente({
        reprendre: () => {
          sortieAutorisee.current = true;
          setSortieEnAttente(null);
          navigation.dispatch(evenement.data.action);
        },
      });
    });

    return retirer;
  }, [actif, navigation]);

  return {
    sortieEnAttente,
    annulerSortie: () => setSortieEnAttente(null),
  };
}
