// Port de données (CLAUDE.md §2/§3) : second port du dépôt, à côté de src/services/auth/ —
// annoncé dès P1.6 (voir le commentaire d'en-tête de src/services/auth/port.ts, "le compte et
// les profils sont un AUTRE port"), construit ici à P1.10 parce que garde.ts en a enfin
// besoin. Deux adaptateurs : src/services/donnees/supabase.ts (réel) et
// src/services/donnees/faux.ts (en mémoire, pour les tests d'écran) — jamais un troisième
// chemin, jamais un import direct de src/services/supabase/ ailleurs (couvert par
// src/test/aucun-import-supabase-direct.test.ts, déjà écrit pour src/services/auth/).
//
// Périmètre volontairement minimal, PAS le contrat complet de docs/api.md §3 (GET /moi, avec
// noms, photos, `attentes`...) : seulement ce que src/fonctionnalites/identite/garde.ts a
// besoin de savoir pour router une session vers le bon espace. Le port grandira lot par lot
// (L1-06 bascule d'espace, L1-07 écran compte...), jamais construit d'avance pour un besoin
// hypothétique.
//
// `profilActif` n'est PAS "aucun profil choisi" — comptes.profil_actif est NOT NULL, défaut
// 'client' (0001_creer_identite.sql), posé à la création du compte, AVANT tout profil réel.
// Un compte flambant neuf a donc déjà `profilActif: 'client'` sans qu'aucun profil client
// n'existe. C'est pour ça que ce type porte aussi `clientExiste`/`coachExiste` : sans eux,
// impossible de distinguer "vraiment un profil client actif" d'"aucun profil du tout".
export type ProfilActif = 'client' | 'coach';

export type EtatProfils = {
  profilActif: ProfilActif;
  clientExiste: boolean;
  coachExiste: boolean;
};

export type PortDonnees = {
  lireEtatProfils(): Promise<EtatProfils>;
};
