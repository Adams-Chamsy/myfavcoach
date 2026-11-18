import { type Href, useFocusEffect, useRouter } from 'expo-router';

import { useCallback, useState } from 'react';
import { ProgressionClient } from '@/fonctionnalites/suivi/progression-client';

import { EcranOngletSeance } from '@/fonctionnalites/seance/ecran-onglet-seance';

// Écran 05 (docs/ecrans/L6-05-seance-du-jour.md), l'onglet. Aucune logique ici (CLAUDE.md §5).
export default function Seance() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );
  return (
    <EcranOngletSeance
      progression={visible ? <ProgressionClient /> : null}
      onOuvrir={(id) => router.push(`/(client)/seance/${encodeURIComponent(id)}` as Href)}
    />
  );
}
