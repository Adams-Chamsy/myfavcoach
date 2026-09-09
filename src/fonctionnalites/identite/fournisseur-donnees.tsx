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
import type { EtatProfils, PortDonnees, PortDonneesLecture } from '@/services/donnees/port';

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
// Le rafraîchissement de l'état appartient au fournisseur, pas à l'appelant (P1.15). Trois
// écritures changent `EtatProfils` côté serveur — `creerProfilCoach`, `basculerProfil`,
// `enregistrerInformations` — et après chacune, l'état lu ici est périmé jusqu'au prochain
// montage. Entre P1.13 et P1.15, chaque appelant devait penser à relire ensuite : trois fois,
// l'un d'eux a oublié, et le défaut ne vire jamais rouge parce qu'un test d'écran monte
// l'écran seul et ne regarde jamais ce qu'un consommateur voisin lit après (CLAUDE.md §8).
// Donc le fournisseur enveloppe ces trois-là : `useDonnees()` n'expose PLUS la méthode brute,
// il expose une version qui relit l'état en cas de succès. `useDonnees().port` est typé
// `PortDonneesLecture` (ces trois retirées) : un écran ne peut plus les appeler par erreur.
// Les écrans d'onboarding client (P1.11) restent hors du lot : chaque étape navigue par un
// `router.push` direct, la reprise repart d'un fournisseur neuf — rien à rafraîchir en place.
export type EcrituresEtatProfils = Pick<
  PortDonnees,
  'creerProfilCoach' | 'basculerProfil' | 'enregistrerInformations'
>;

type EtatDonneesCommun = { port: PortDonneesLecture } & EcrituresEtatProfils;

export type EtatDonnees =
  | ({ chargement: true; profils: null } & EtatDonneesCommun)
  | ({ chargement: false; profils: EtatProfils | null } & EtatDonneesCommun);

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

  // Les trois écritures d'EtatProfils, enveloppées : même signature que le port, mais une
  // relecture de l'état en cas de succès. `rafraichir` ne relit rien tant qu'il n'y a pas de
  // session vérifiée (garde interne) — un échec du port laisse donc l'état intact. Stables tant
  // que `port` l'est (prop injectée) : sûres en dépendance d'un `useEffect` d'écran.
  const creerProfilCoach = useCallback<PortDonnees['creerProfilCoach']>(
    async (donnees) => {
      const resultatEcriture = await port.creerProfilCoach(donnees);
      if (resultatEcriture.succes) await rafraichir();
      return resultatEcriture;
    },
    [port, rafraichir],
  );
  const basculerProfil = useCallback<PortDonnees['basculerProfil']>(
    async (profil) => {
      const resultatEcriture = await port.basculerProfil(profil);
      if (resultatEcriture.succes) await rafraichir();
      return resultatEcriture;
    },
    [port, rafraichir],
  );
  const enregistrerInformations = useCallback<PortDonnees['enregistrerInformations']>(
    async (modifs) => {
      const resultatEcriture = await port.enregistrerInformations(modifs);
      if (resultatEcriture.succes) await rafraichir();
      return resultatEcriture;
    },
    [port, rafraichir],
  );

  const ecritures: EcrituresEtatProfils = {
    creerProfilCoach,
    basculerProfil,
    enregistrerInformations,
  };

  const etat: EtatDonnees = !compteIdVerifie
    ? { chargement: false, profils: null, port, ...ecritures }
    : resultat && resultat.compteId === compteIdVerifie
      ? { chargement: false, profils: resultat.profils, port, ...ecritures }
      : { chargement: true, profils: null, port, ...ecritures };

  return <ContexteDonnees.Provider value={etat}>{children}</ContexteDonnees.Provider>;
}

export function useDonnees(): EtatDonnees {
  const contexte = useContext(ContexteDonnees);
  if (!contexte) {
    throw new Error('useDonnees doit être appelé à l’intérieur de <FournisseurDonnees>.');
  }
  return contexte;
}
