import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { BadgeClient } from '@/services/donnees/port';

export function nomClient(prenom: string, nom: string | null) {
  return [prenom, nom].filter(Boolean).join(' ');
}

export function texteBadge(badge: BadgeClient, nombre: number | null) {
  if (badge === 'paiement_ko') return 'Paiement en échec';
  if (badge === 'nouveau') return 'Nouveau';
  if (badge === 'a_jour') return 'À jour';
  return nombre === 1 ? '1 séance non rattrapée' : `${nombre ?? 0} séances non rattrapées`;
}

export function useLectureCoach<T>(lire: () => Promise<T>) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const [tentative, setTentative] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void lire().then(
        (resultat) => {
          if (actif) {
            setDonnees(resultat);
            setErreur(null);
          }
        },
        (cause) => {
          if (actif) setErreur(cause);
        },
      );
      return () => {
        actif = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Le bouton Réessayer rejoue la lecture.
    }, [lire, tentative]),
  );

  return { donnees, erreur, relire: () => setTentative((n) => n + 1) };
}
