import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

import { useSession } from './fournisseur-session';
import type { EtatProfils, PortDonnees } from '@/services/donnees/port';

// Miroir de fournisseur-session.tsx (P1.8), pour src/services/donnees/ (P1.10). Ne lit
// JAMAIS le port tant qu'aucune session vérifiée n'existe : un compte non vérifié ou non
// connecté n'a pas de profils à lire, et interroger quand même serait un appel réseau pour
// rien (voir docs/ecrans/L1-03-verification-email.md, "aucun appel réseau répété" — même
// discipline ici).
//
// `profils: null` a deux sens distincts, jamais confondus : "pas de session vérifiée" (chargement
// false, jamais interrogé) et "l'appel a échoué" (chargement false aussi, mais après une vraie
// tentative). garde.ts n'a pas besoin de les distinguer — dans les deux cas, la seule décision
// sûre est le repli vers l'onboarding (voir son commentaire) — donc ce fournisseur ne les
// distingue pas non plus, plutôt que d'exposer une troisième valeur que personne ne lirait.
// `port` voyage dans le contexte, à côté de `profils` (P1.11) : les quatre écrans
// d'onboarding (docs/ecrans/L1-05) doivent pouvoir ÉCRIRE (creerProfilClient, etc.), pas
// seulement lire l'état déjà chargé. Toujours présent (même en chargement) : c'est
// l'INJECTION du port qui est synchrone (voir ProprietesFournisseurDonnees), seule la LECTURE
// initiale est asynchrone.
//
// Pas de rafraîchir() ici, délibérément : aucun écran de ce lot ne relit `profils` après une
// écriture dans la MÊME session d'app — chaque étape navigue par un `router.push` direct vers
// la suivante (jamais via determinerDestination), et la reprise après fermeture/réouverture
// (critère 2 de L1-05) repart d'un FournisseurDonnees fraîchement monté, qui relit déjà l'état
// serveur à jour. À ajouter si un futur écran a besoin de voir ses propres écritures reflétées
// dans `profils` sans redémarrer l'app.
export type EtatDonnees =
  | { chargement: true; profils: null; port: PortDonnees }
  | { chargement: false; profils: EtatProfils | null; port: PortDonnees };

const ContexteDonnees = createContext<EtatDonnees | null>(null);

export type ProprietesFournisseurDonnees = {
  children: ReactNode;
  // Injection par le fournisseur (CLAUDE.md — règle de L0, déjà appliquée par
  // FournisseurSession) : jamais un import direct de src/services/donnees/supabase.ts dans un
  // écran. Le vrai écran reçoit portDonneesSupabase depuis app/_layout.tsx ; un test reçoit
  // creerFauxPortDonnees().
  port: PortDonnees;
};

// Ce que la dernière lecture a rendu, avec le compteId AUQUEL elle répond — jamais un simple
// booléen "chargement" géré à côté : un état séparé peut rester obsolète pendant un rendu
// (trouvé en écrivant ce fichier, pas en production) entre le moment où la session change et
// celui où l'effet qui devrait relancer la lecture s'exécute enfin. `etat` ci-dessous est
// dérivé de session + resultat à CHAQUE rendu, jamais mis en cache séparément : aucun rendu
// intermédiaire ne peut donc annoncer "chargement terminé" avec les profils d'un autre compte.
type ResultatLecture = { compteId: string; profils: EtatProfils | null };

export function FournisseurDonnees({ children, port }: ProprietesFournisseurDonnees) {
  const { session } = useSession();
  const [resultat, setResultat] = useState<ResultatLecture | null>(null);

  useEffect(() => {
    if (!session || !session.emailVerifie) return;

    let monte = true;
    const compteId = session.compteId;

    port
      .lireEtatProfils()
      .then((profils) => {
        if (monte) setResultat({ compteId, profils });
      })
      .catch(() => {
        // Une lecture qui échoue n'autorise rien (même principe que FournisseurSession) :
        // repli sûr vers "profils: null", que garde.ts traite comme "onboarding non terminé",
        // jamais comme un espace client ou coach.
        if (monte) setResultat({ compteId, profils: null });
      });

    return () => {
      monte = false;
    };
    // session?.compteId / emailVerifie, pas l'objet session : sa référence change à chaque
    // notification de FournisseurSession (ex. rafraîchissement de jeton), sans que ces deux
    // valeurs changent — redéclencher la lecture à chaque fois serait un appel réseau superflu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.compteId, session?.emailVerifie, port]);

  const etat: EtatDonnees =
    !session || !session.emailVerifie
      ? { chargement: false, profils: null, port }
      : resultat && resultat.compteId === session.compteId
        ? { chargement: false, profils: resultat.profils, port }
        : { chargement: true, profils: null, port };

  return <ContexteDonnees.Provider value={etat}>{children}</ContexteDonnees.Provider>;
}

export function useDonnees(): EtatDonnees {
  const contexte = useContext(ContexteDonnees);
  if (!contexte) {
    throw new Error('useDonnees doit être appelé à l’intérieur de <FournisseurDonnees>.');
  }
  return contexte;
}
