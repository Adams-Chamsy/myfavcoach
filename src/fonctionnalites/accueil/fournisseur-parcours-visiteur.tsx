import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ReactElement,
} from 'react';

import {
  estIdentifiantCoach,
  lireRetourCoach,
  type PortAccueil,
  type RetourCoach,
} from '@/services/accueil/port';

type ParcoursVisiteur = {
  chargement: boolean;
  marqueVue: boolean;
  retourCoach: RetourCoach | null;
  terminerOuverture(): void;
  retenirCoach(coachId: string, intention?: RetourCoach['intention']): void;
  oublierRetour(): void;
};

// Les corps d'écran isolés de la galerie n'accèdent à aucun stockage et ne déclenchent
// aucune animation d'ouverture. La vraie racine injecte toujours le fournisseur ci-dessous.
const SANS_PERSISTANCE: ParcoursVisiteur = {
  chargement: false,
  marqueVue: true,
  retourCoach: null,
  terminerOuverture: () => {},
  retenirCoach: () => {},
  oublierRetour: () => {},
};
const Contexte = createContext<ParcoursVisiteur>(SANS_PERSISTANCE);
const DELAI_PREFERENCES_MS = 800; // Une préférence d'interface ne bloque jamais le démarrage.

export function FournisseurParcoursVisiteur({
  children,
  port,
}: {
  children: ReactNode;
  port: PortAccueil;
}): ReactElement {
  const [etat, setEtat] = useState({
    chargement: true,
    marqueVue: true,
    retourCoach: null as RetourCoach | null,
  });
  const revision = useRef(0);
  const ecritures = useRef(Promise.resolve());
  const ecrire = useCallback((action: () => Promise<void>) => {
    // Une lecture tardive ou deux écritures concurrentes ne doivent pas restaurer un ancien
    // retour. Une panne du stockage reste sans effet sur le geste courant en mémoire.
    ecritures.current = ecritures.current.then(action).catch(() => {});
  }, []);
  useEffect(() => {
    let monte = true;
    const version = revision.current;
    const minuteur = setTimeout(() => {
      if (monte) setEtat((e) => ({ ...e, chargement: false }));
      monte = false;
    }, DELAI_PREFERENCES_MS);
    port
      .lire()
      .then((preferences) => {
        if (monte && revision.current === version) {
          setEtat({
            chargement: false,
            marqueVue: preferences.marqueVue,
            retourCoach: lireRetourCoach(JSON.stringify(preferences.retourCoach)),
          });
        }
      })
      .catch(() => {
        if (monte) setEtat((e) => ({ ...e, chargement: false }));
      })
      .finally(() => clearTimeout(minuteur));
    return () => {
      monte = false;
      clearTimeout(minuteur);
    };
  }, [port]);
  const terminerOuverture = useCallback(() => {
    revision.current += 1;
    setEtat((e) => ({ ...e, chargement: false, marqueVue: true }));
    ecrire(() => port.marquerOuvertureVue());
  }, [port, ecrire]);
  const retenirCoach = useCallback(
    (coachId: string, intention?: RetourCoach['intention']) => {
      if (!estIdentifiantCoach(coachId)) return;
      revision.current += 1;
      const retourCoach = { coachId, creeLe: Date.now(), ...(intention ? { intention } : {}) };
      setEtat((e) => ({ ...e, chargement: false, retourCoach }));
      ecrire(() => port.enregistrerRetour(retourCoach));
    },
    [port, ecrire],
  );
  const oublierRetour = useCallback(() => {
    revision.current += 1;
    setEtat((e) => ({ ...e, chargement: false, retourCoach: null }));
    ecrire(() => port.enregistrerRetour(null));
  }, [port, ecrire]);
  return (
    <Contexte.Provider value={{ ...etat, terminerOuverture, retenirCoach, oublierRetour }}>
      {children}
    </Contexte.Provider>
  );
}

export function useParcoursVisiteur(): ParcoursVisiteur {
  return useContext(Contexte);
}
