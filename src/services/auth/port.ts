// Port d'authentification (CLAUDE.md §2/§3) : seul point d'entrée que l'application connaît
// pour tout ce qui touche à l'identité. Deux adaptateurs le respectent — src/services/auth/
// supabase.ts (réel) et src/services/auth/faux.ts (en mémoire, pour les tests d'écran) —
// jamais un troisième chemin, jamais un import direct de src/services/supabase/ ailleurs
// (src/test/aucun-import-supabase-direct.test.ts le vérifie).
//
// Périmètre : uniquement la session d'authentification (jetons Supabase Auth). Le compte et
// les profils (docs/api.md §3 : GET /moi, bascule d'espace...) sont un AUTRE port
// (src/services/donnees/, lot ultérieur).
//
// Aucune deuxième mémoire de session : le stockage chiffré du client Supabase
// (src/services/supabase/stockage-securise.ts) est la SEULE persistance de la session, écrite
// et relue par le service d'authentification lui-même. src/services/trousseau/ (lot L0, lecture
// seule, jamais écrite) a été supprimé en préparant P1.8 plutôt que complété : une deuxième
// mémoire aurait divergé de celle-ci le jour où l'une est mise à jour et pas l'autre. Le profil
// actif vient du serveur (docs/ecrans/L1-06-bascule-espace.md, basculer_profil) — jamais d'une
// mémoire locale.

export type SessionAuth = {
  compteId: string;
  email: string;
  emailVerifie: boolean;
  jetonAcces: string;
  jetonRafraichissement: string;
};

// Codes reconnus par les écrans (docs/ecrans/L1-02-creation-compte.md, tableau des messages
// autorisés ; docs/ecrans/L1-04-connexion.md). Un écran branche son comportement sur `code`,
// jamais sur `message` (docs/api.md §1) — `message` reste indicatif, utile en journal de
// développement, jamais garanti stable.
export type CodeErreurAuth =
  | 'identifiants_invalides'
  | 'age_insuffisant'
  | 'limite_debit'
  | 'lien_expire'
  | 'reseau'
  | 'serveur';

export type ErreurAuth = {
  code: CodeErreurAuth;
  message: string;
};

export type ResultatAuth = { succes: true } | { succes: false; erreur: ErreurAuth };

// Trois issues, pas deux : un compte non vérifié qui se connecte n'est ni un succès (pas de
// session) ni un échec (docs/ecrans/L1-04-connexion.md, "n'est pas rejeté : il arrive sur
// L1-03, pas sur un message d'erreur") — l'appelant doit pouvoir distinguer les trois sans
// inspecter le texte d'une erreur.
export type ResultatConnexion =
  | { type: 'connecte'; session: SessionAuth }
  | { type: 'email_non_verifie' }
  | { type: 'echec'; erreur: ErreurAuth };

export type PortAuth = {
  // jetonInvitation (L3bis) : facultatif, transmis tel quel jusqu'aux métadonnées d'inscription
  // (creer_compte_depuis_auth, 0027) — absent pour la grande majorité des inscriptions, jamais
  // une exigence de ce port. Voir docs/prompts/L3bis.md, P3bis.3.
  inscrire(
    email: string,
    motDePasse: string,
    dateNaissance: string,
    jetonInvitation?: string,
  ): Promise<ResultatAuth>;
  connecter(email: string, motDePasse: string): Promise<ResultatConnexion>;
  deconnecter(): Promise<void>;
  renvoyerVerification(email: string): Promise<ResultatAuth>;
  demanderReinitialisation(email: string): Promise<ResultatAuth>;
  // Ferme aussi TOUTES LES AUTRES sessions du compte (docs/ecrans/L1-04-connexion.md, "Nouveau
  // mot de passe" : "toutes les autres sessions du compte sont fermées") — jamais celle-ci,
  // qui vient justement d'authentifier l'appel. Prouvé contre la base réelle par
  // src/test/rls.banc.ts, pas par un simulacre (critère 4 de la fiche).
  changerMotDePasse(nouveauMotDePasse: string): Promise<ResultatAuth>;

  // docs/ecrans/L1-09-mes-informations.md, « Adresse e-mail et mot de passe » (P1.13c) :
  // changement de mot de passe DEPUIS une session ouverte, avec vérification du mot de passe
  // actuel (un téléphone brièvement déverrouillé ne doit pas suffire). Distinct de
  // changerMotDePasse ci-dessus, qui sert le parcours de récupération par lien (L1-04) où il
  // n'y a PAS de mot de passe actuel à connaître. Un `actuel` faux rend
  // `{ code: 'identifiants_invalides' }`. Ferme aussi toutes les AUTRES sessions du compte,
  // comme changerMotDePasse.
  changerMotDePasseConnecte(actuel: string, nouveau: string): Promise<ResultatAuth>;

  // docs/ecrans/L1-09 : le changement d'adresse n'est effectif qu'après confirmation sur les
  // DEUX adresses (l'ancienne et la nouvelle). Déclenche l'envoi des deux courriels ; l'adresse
  // du compte ne change pas tant que les deux liens ne sont pas suivis.
  changerEmail(nouvelEmail: string): Promise<ResultatAuth>;

  // L'adresse vers laquelle un changement est en cours mais pas encore confirmé (les deux
  // liens pas encore suivis), ou null s'il n'y en a pas. Sert le bandeau d'attente persistant
  // de L1-09.
  lireAdresseEnAttente(): Promise<string | null>;
  sessionCourante(): Promise<SessionAuth | null>;
  // Renvoie la fonction de désabonnement (convention des effets React : `useEffect(() =>
  // port.surChangementDeSession(cb), [])`).
  surChangementDeSession(ecouteur: (session: SessionAuth | null) => void): () => void;
  // Lien profond, générique aux DEUX liens que l'application reçoit par courriel — vérification
  // (docs/ecrans/L1-03-verification-email.md, myfavcoach://auth/rappel) ET réinitialisation de
  // mot de passe (docs/ecrans/L1-04-connexion.md, myfavcoach://auth/mot-de-passe) : les deux
  // échangent un `code` PKCE de la même façon côté Supabase, aucune raison de dupliquer cette
  // méthode. Le succès établit la session (et confirme l'adresse, pour le premier cas) —
  // l'appelant n'a rien d'autre à faire : surChangementDeSession() est notifié comme pour
  // connecter(). N'importe jamais l'URL brute au-delà de ce port : c'est le seul endroit qui
  // sait comment un lien Supabase se lit.
  etablirSessionDepuisLien(url: string): Promise<ResultatAuth>;
};
