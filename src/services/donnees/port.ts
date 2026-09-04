// Port de données (CLAUDE.md §2/§3) : second port du dépôt, à côté de src/services/auth/ —
// annoncé dès P1.6 (voir le commentaire d'en-tête de src/services/auth/port.ts, "le compte et
// les profils sont un AUTRE port"), construit ici à P1.10 parce que garde.ts en a enfin
// besoin, complété à P1.11 pour l'onboarding client.
//
// Périmètre volontairement minimal, PAS le contrat complet de docs/api.md §3 (GET /moi, avec
// noms, photos, `attentes`...) : seulement ce dont src/fonctionnalites/identite/garde.ts et
// l'onboarding client (docs/ecrans/L1-05) ont besoin. Le port grandira lot par lot (L1-06
// bascule d'espace, L1-07 écran compte...), jamais construit d'avance pour un besoin
// hypothétique.
//
// `profilActif` n'est PAS "aucun profil choisi" — comptes.profil_actif est NOT NULL, défaut
// 'client' (0001_creer_identite.sql), posé à la création du compte, AVANT tout profil réel.
// Un compte flambant neuf a donc déjà `profilActif: 'client'` sans qu'aucun profil client
// n'existe. C'est pour ça que ce type porte aussi `clientExiste`/`coachExiste` : sans eux,
// impossible de distinguer "vraiment un profil client actif" d'"aucun profil du tout".
export type ProfilActif = 'client' | 'coach';

// null quand clientExiste est false : aucune étape n'a de sens sans profil. > 4 signifie
// onboarding terminé (docs/ecrans/L1-05 n'a que quatre étapes) — voir
// src/fonctionnalites/identite/garde.ts pour la valeur exacte et son usage.
export type EtatProfils = {
  profilActif: ProfilActif;
  clientExiste: boolean;
  clientOnboardingEtape: number | null;
  coachExiste: boolean;
};

export type ResultatEcriture = { succes: true } | { succes: false; erreur: string };

// Ce que les quatre étapes ont accumulé jusqu'ici — distinct d'EtatProfils (qui ne porte que
// le ROUTAGE : quelle étape afficher, jamais son contenu). Nécessaire pour deux besoins réels,
// pas construit d'avance : le critère 2 de docs/ecrans/L1-05 ("Quitter l'application à l'étape
// 3 et la rouvrir ramène à l'étape 3, avec les étapes 1 et 2 CONSERVÉES") — chaque étape doit
// pouvoir se pré-remplir depuis le serveur à la reprise, pas seulement savoir laquelle
// afficher — et le récapitulatif de l'étape 4/4. Valeurs par défaut ("rien encore") plutôt
// qu'une absence à gérer : plus simple pour les quatre appelants, qui n'ont jamais besoin de
// distinguer "pas encore de ligne" de "ligne avec des champs vides".
export type ProfilOnboarding = {
  prenom: string;
  nom: string | null;
  objectifs: string[];
  rythme: string | null;
  poidsDepartGrammes: number | null;
  poidsCibleGrammes: number | null;
};

export type PortDonnees = {
  lireEtatProfils(): Promise<EtatProfils>;

  // N'a de sens qu'une fois clientExiste=true (EtatProfils) — avant, rend les valeurs par
  // défaut de ProfilOnboarding ci-dessus, jamais une exception : épargne à chaque appelant de
  // vérifier clientExiste avant d'appeler.
  lireProfilOnboarding(): Promise<ProfilOnboarding>;

  // docs/ecrans/L1-05-onboarding-client.md, étape 1/4 : "Un profil client existe dès l'étape 1
  // validée." Fait passer onboarding_etape à 2. Prénom seul est obligatoire côté écran ; ce
  // port ne revalide pas cette règle (déjà portée par l'écran et par la contrainte NOT NULL de
  // profils_client.prenom), il transmet ce qu'on lui donne.
  creerProfilClient(prenom: string, nom: string): Promise<ResultatEcriture>;

  // Étape 2/4 : objectifs (clés de src/fixtures/demonstration.ts, jamais un libellé) et
  // rythme. Fait passer onboarding_etape à 3. "Passer" : objectifs = [], rythme = null.
  enregistrerObjectifsEtRythme(
    objectifs: string[],
    rythme: string | null,
  ): Promise<ResultatEcriture>;

  // Étape 3/4 : consentement santé (avec sa version de texte, docs/domaine.md §3.12) PUIS
  // poids, dans cet ordre — le déclencheur de 0004_proteger_donnees_sante.sql refuse le poids
  // sans consentement déjà enregistré. Fait passer onboarding_etape à 4. "Passer" :
  // consentementAccorde=false, aucun poids.
  enregistrerPointDeDepart(donnees: {
    consentementAccorde: boolean;
    versionConsentement: string;
    poidsDepartGrammes?: number;
    poidsCibleGrammes?: number;
  }): Promise<ResultatEcriture>;

  // Étape 4/4 : marque l'onboarding terminé (onboarding_etape à 5 — voir garde.ts).
  terminerOnboarding(): Promise<ResultatEcriture>;
};
