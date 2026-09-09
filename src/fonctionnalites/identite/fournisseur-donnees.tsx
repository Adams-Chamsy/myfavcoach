import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

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
// `port` voyage dans le contexte, à côté de `profils` (P1.11) : les écrans qui ÉCRIVENT
// (creerProfilClient, creerProfilCoach, etc.) en ont besoin, pas seulement ceux qui lisent
// l'état déjà chargé. Toujours présent (même en chargement) : c'est l'INJECTION du port qui
// est synchrone (voir ProprietesFournisseurDonnees), seule la LECTURE initiale est asynchrone.
//
// `rafraichir()` — ajouté à P1.14 (docs/ecrans/L1-08-activation-espace-coach.md). L'activation
// de l'espace coach CRÉE un profil qui n'existait pas au dernier `lireEtatProfils` : sans
// relire, la feuille de bascule (L1-06) montrerait un état faux (`coachExiste: false`) dans la
// session MÊME où le profil vient d'être créé — donc au moment précis où l'utilisateur veut
// l'utiliser. Les écrans d'onboarding client (P1.11) n'en ont pas besoin (chaque étape navigue
// par un `router.push` direct, la reprise repart d'un fournisseur fraîchement monté) : c'est
// pour ça qu'il n'existait pas avant.
export type EtatDonnees =
  | { chargement: true; profils: null; port: PortDonnees; rafraichir: () => Promise<void> }
  | {
      chargement: false;
      profils: EtatProfils | null;
      port: PortDonnees;
      rafraichir: () => Promise<void>;
    };

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

  const compteIdVerifie = session?.emailVerifie ? session.compteId : undefined;

  // Comparé au moment où une lecture se résout : le compte vérifié a pu changer entre-temps
  // (session fermée, autre compte) ou le composant être démonté — dans ces cas on ignore le
  // résultat plutôt que d'écraser l'état avec des profils périmés. Écrit à chaque rendu, jamais
  // lu pendant le rendu (seul un gestionnaire asynchrone le lit).
  const compteIdRef = useRef(compteIdVerifie);
  useEffect(() => {
    compteIdRef.current = compteIdVerifie;
  });

  const rafraichir = useCallback(async () => {
    const compteId = compteIdRef.current;
    if (!compteId) return;
    try {
      const profils = await port.lireEtatProfils();
      if (compteIdRef.current === compteId) setResultat({ compteId, profils });
    } catch {
      // Une lecture qui échoue n'autorise rien (même principe que FournisseurSession) : repli
      // sûr vers "profils: null", que garde.ts traite comme "onboarding non terminé", jamais
      // comme un espace client ou coach.
      if (compteIdRef.current === compteId) setResultat({ compteId, profils: null });
    }
  }, [port]);

  // Lecture initiale, et relance quand le compte vérifié change (connexion, vérification,
  // bascule de compte). `rafraichir` ne dépend que de `port` : la relance est pilotée par
  // `compteIdVerifie` ici, pas par une nouvelle identité de fonction.
  useEffect(() => {
    void rafraichir();
  }, [rafraichir, compteIdVerifie]);

  const etat: EtatDonnees = !compteIdVerifie
    ? { chargement: false, profils: null, port, rafraichir }
    : resultat && resultat.compteId === compteIdVerifie
      ? { chargement: false, profils: resultat.profils, port, rafraichir }
      : { chargement: true, profils: null, port, rafraichir };

  return <ContexteDonnees.Provider value={etat}>{children}</ContexteDonnees.Provider>;
}

export function useDonnees(): EtatDonnees {
  const contexte = useContext(ContexteDonnees);
  if (!contexte) {
    throw new Error('useDonnees doit être appelé à l’intérieur de <FournisseurDonnees>.');
  }
  return contexte;
}
