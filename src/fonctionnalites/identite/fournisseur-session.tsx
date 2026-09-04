import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

import type { PortAuth, SessionAuth } from '@/services/auth/port';

// Chargement distinct de "pas de session" : au démarrage, avant que sessionCourante() n'ait
// répondu, on ne sait pas encore s'il y a une session — ce n'est ni "connecté" ni "déconnecté".
// Confondre les deux ferait clignoter l'écran public avant de router vers l'espace actif.
//
// `port` est TOUJOURS présent, y compris pendant le chargement : c'est la seule façon pour un
// écran d'appeler inscrire/connecter/etc. par injection du fournisseur (CLAUDE.md, règle de
// L0 : jamais un import direct de src/services/auth/supabase.ts dans un écran). Ajouté en
// préparant P1.8 (L1-02/L1-03) : le fournisseur n'exposait jusque-là que l'état de la session,
// jamais le port lui-même — aucun écran ne pouvait donc appeler la moindre action.
export type EtatSession =
  | { chargement: true; session: null; port: PortAuth }
  | { chargement: false; session: SessionAuth | null; port: PortAuth };

const ContexteSession = createContext<EtatSession | null>(null);

export type ProprietesFournisseurSession = {
  children: ReactNode;
  // Injection par le fournisseur (CLAUDE.md — règle de L0) : jamais un import direct de
  // src/services/auth/supabase.ts ici, jamais un jest.mock de module dans les tests. Le vrai
  // écran reçoit portAuthSupabase depuis app/_layout.tsx ; un test d'écran reçoit
  // creerFauxPortAuth().
  port: PortAuth;
};

export function FournisseurSession({ children, port }: ProprietesFournisseurSession) {
  const [etat, setEtat] = useState<EtatSession>({ chargement: true, session: null, port });

  useEffect(() => {
    let monte = true;

    port
      .sessionCourante()
      .then((session) => {
        if (monte) setEtat({ chargement: false, session, port });
      })
      .catch(() => {
        // Une lecture qui échoue n'est pas une session : `chargement` doit se résoudre quand
        // même, sinon un rejet bloque le démarrage à froid indéfiniment sur l'écran d'attente
        // (app/index.tsx). Repli sûr : traité comme "pas de session", jamais comme "connecté".
        if (monte) setEtat({ chargement: false, session: null, port });
      });

    const arreterEcoute = port.surChangementDeSession((session) => {
      if (monte) setEtat({ chargement: false, session, port });
    });

    return () => {
      monte = false;
      arreterEcoute();
    };
  }, [port]);

  return <ContexteSession.Provider value={etat}>{children}</ContexteSession.Provider>;
}

export function useSession(): EtatSession {
  const contexte = useContext(ContexteSession);
  if (!contexte) {
    throw new Error('useSession doit être appelé à l’intérieur de <FournisseurSession>.');
  }
  return contexte;
}
