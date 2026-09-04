// Port d'authentification (CLAUDE.md §2/§3) : seul point d'entrée que l'application connaît
// pour tout ce qui touche à l'identité. Deux adaptateurs le respectent — src/services/auth/
// supabase.ts (réel) et src/services/auth/faux.ts (en mémoire, pour les tests d'écran) —
// jamais un troisième chemin, jamais un import direct de src/services/supabase/ ailleurs
// (src/test/aucun-import-supabase-direct.test.ts le vérifie).
//
// Périmètre : uniquement la session d'authentification (jetons Supabase Auth). Le compte et
// les profils (docs/api.md §3 : GET /moi, bascule d'espace...) sont un AUTRE port
// (src/services/donnees/, lot ultérieur) — SessionAuth n'a donc rien à voir avec le type
// Session de src/services/trousseau/trousseau.ts (jeton + profil actif PERSISTÉS localement) :
// deux types différents, jamais confondus sous le même nom.

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
  'identifiants_invalides' | 'age_insuffisant' | 'limite_debit' | 'reseau' | 'serveur';

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
  inscrire(email: string, motDePasse: string, dateNaissance: string): Promise<ResultatAuth>;
  connecter(email: string, motDePasse: string): Promise<ResultatConnexion>;
  deconnecter(): Promise<void>;
  renvoyerVerification(email: string): Promise<ResultatAuth>;
  demanderReinitialisation(email: string): Promise<ResultatAuth>;
  changerMotDePasse(nouveauMotDePasse: string): Promise<ResultatAuth>;
  changerEmail(nouvelEmail: string): Promise<ResultatAuth>;
  sessionCourante(): Promise<SessionAuth | null>;
  // Renvoie la fonction de désabonnement (convention des effets React : `useEffect(() =>
  // port.surChangementDeSession(cb), [])`).
  surChangementDeSession(ecouteur: (session: SessionAuth | null) => void): () => void;
};
