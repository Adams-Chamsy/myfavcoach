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
export type EtatDonnees =
  { chargement: true; profils: null } | { chargement: false; profils: EtatProfils | null };

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
      ? { chargement: false, profils: null }
      : resultat && resultat.compteId === session.compteId
        ? { chargement: false, profils: resultat.profils }
        : { chargement: true, profils: null };

  return <ContexteDonnees.Provider value={etat}>{children}</ContexteDonnees.Provider>;
}

export function useDonnees(): EtatDonnees {
  const contexte = useContext(ContexteDonnees);
  if (!contexte) {
    throw new Error('useDonnees doit être appelé à l’intérieur de <FournisseurDonnees>.');
  }
  return contexte;
}
