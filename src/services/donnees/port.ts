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
//
// identiteActive et attentesCoach : ajoutés pour L1-06 (feuille de bascule), pas construits
// d'avance. identiteActive porte prénom/nom du profil ACTIF (profils_client ou profils_coach
// selon profilActif) — jamais photoUrl : Avatar (src/composants/avatar.tsx) n'affiche que des
// initiales, aucun code de ce dépôt ne sait encore rendre une vraie photo (Storage = L2).
// attentesCoach vaut toujours 0 à ce lot (docs/ecrans/L1-06-bascule-espace.md : "il n'y a ni
// message ni demande") — voir docs/dette.md pour le lot qui le calculera réellement (L8).
export type EtatProfils = {
  profilActif: ProfilActif;
  clientExiste: boolean;
  clientOnboardingEtape: number | null;
  coachExiste: boolean;
  identiteActive: { prenom: string; nom: string | null };
  attentesCoach: number;
};

export type ResultatEcriture = { succes: true } | { succes: false; erreur: string };

// docs/ecrans/L1-09-mes-informations.md, « Mes informations ». Le formulaire modifie le PROFIL
// ACTIF, pas le compte — il n'est donc pas le même des deux côtés, d'où l'union discriminée.
// `dateNaissance` vient de comptes.date_naissance (ISO 'AAAA-MM-JJ') : toujours en lecture
// seule, elle porte la règle des 18 ans (colonne hors de la liste GRANT UPDATE,
// 0001_creer_identite.sql). `discipline` (coach) est en lecture seule à ce lot : la liste
// figée des disciplines est une décision produit qui gouverne la recherche du lot L3, prise à
// P1.14 (activation de l'espace coach), pas ici.
export type InformationsCompte =
  | { profil: 'client'; prenom: string; nom: string | null; dateNaissance: string }
  | {
      profil: 'coach';
      prenom: string;
      nom: string;
      discipline: string;
      titreCourt: string | null;
      bio: string | null;
      dateNaissance: string;
    };

// Ce que l'écran peut réécrire — jamais dateNaissance ni discipline (voir InformationsCompte).
export type ModificationsInformations =
  | { profil: 'client'; prenom: string; nom: string | null }
  | { profil: 'coach'; prenom: string; nom: string; titreCourt: string | null; bio: string | null };

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

  // docs/ecrans/L1-06-bascule-espace.md : appelle la fonction de base basculer_profil(profil)
  // (0002_politiques.sql, SECURITY DEFINER — comptes.profil_actif n'a aucun GRANT UPDATE pour
  // authenticated). Vérifie elle-même que le profil demandé existe pour ce compte ; refuse
  // sinon. L'application n'écrit JAMAIS profil_actif directement — cette méthode est le seul
  // chemin, et son résultat ne sert qu'à savoir si la bascule a eu lieu, jamais à décider un
  // droit (le champ profilActif rechargé ensuite ne sert que le routage et la palette).
  basculerProfil(profil: ProfilActif): Promise<ResultatEcriture>;

  // docs/ecrans/L1-09-mes-informations.md, « Mes informations ». Lit et écrit le profil ACTIF
  // (profils_client ou profils_coach selon comptes.profil_actif). enregistrerInformations ne
  // touche que les colonnes accordées en UPDATE pour ce lot — jamais date_naissance
  // (protégée), jamais discipline (P1.14).
  lireInformations(): Promise<InformationsCompte>;
  enregistrerInformations(modifs: ModificationsInformations): Promise<ResultatEcriture>;

  // docs/ecrans/L1-09-mes-informations.md, section « Confidentialité » (P1.13d). Le
  // consentement `donneesSante` est un JOURNAL d'ajout (docs/domaine.md §3.12) :
  // enregistrerConsentementSante insère une NOUVELLE ligne (accorde reflétant le nouvel état),
  // jamais une mise à jour. lireConsentementSante rend l'état courant (vue
  // consentements_courants). `version` est null seulement si aucun consentement n'a jamais été
  // enregistré pour ce compte.
  lireConsentementSante(): Promise<{ accorde: boolean; version: string | null }>;
  enregistrerConsentementSante(accorde: boolean, version: string): Promise<ResultatEcriture>;

  // Efface les mesures corporelles enregistrées — à ce lot, poids_depart_grammes et
  // poids_cible_grammes (profils_client), les seules données de santé écrites (voir
  // 0004_proteger_donnees_sante.sql). Les remettre à NULL est autorisé même consentement
  // retiré : le déclencheur ne bloque que l'écriture d'une valeur NON nulle. Irréversible,
  // offert seulement après un retrait de consentement.
  effacerMesuresCorporelles(): Promise<ResultatEcriture>;
};
