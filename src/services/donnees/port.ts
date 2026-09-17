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
//
// `communeInsee`/`communeBaseInsee`, `formats`, `parcoursTexte`, `langues` : ajoutés le
// 13 septembre 2026 (révision de L1-09) — quatre colonnes déjà réelles, déjà accordées en
// UPDATE (0006, 0016, 0022), jamais écrites par aucun écran jusque-là (docs/dette.md). Sans ce
// formulaire, `rechercher_coachs()` (L3) trie sur une proximité et filtre sur un format que
// personne ne peut renseigner.
export type InformationsCompte =
  | {
      profil: 'client';
      prenom: string;
      nom: string | null;
      communeInsee: string | null;
      dateNaissance: string;
    }
  | {
      profil: 'coach';
      prenom: string;
      nom: string;
      discipline: string;
      titreCourt: string | null;
      bio: string | null;
      communeBaseInsee: string | null;
      formats: string[];
      parcoursTexte: string | null;
      langues: string[];
      dateNaissance: string;
    };

// Ce que l'écran peut réécrire — jamais dateNaissance ni discipline (voir InformationsCompte).
export type ModificationsInformations =
  | { profil: 'client'; prenom: string; nom: string | null; communeInsee: string | null }
  | {
      profil: 'coach';
      prenom: string;
      nom: string;
      titreCourt: string | null;
      bio: string | null;
      communeBaseInsee: string | null;
      formats: string[];
      parcoursTexte: string | null;
      langues: string[];
    };

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

// docs/domaine.md §4.2, les six valeurs de statut_verification_enum (0001_creer_identite.sql).
export type StatutVerification =
  'absente' | 'en_examen' | 'complement_demande' | 'verifiee' | 'refusee' | 'revoquee';

// L2-09 : motif = celui renvoyé par le serveur (dernière DecisionVerification, docs/domaine.md
// §3.14), jamais un texte générique inventé à l'écran. deposeLe sert au calcul de l'échéance
// 48 h ouvrées (fiche L2-09) — null tant qu'aucun document n'a été déposé.
export type DossierVerification = {
  statut: StatutVerification;
  deposeLe: string | null;
  motif: string | null;
};

// L2-06 : les trois types fermés du dossier (docs/domaine.md §4.2). Une pièce déposée n'expose
// jamais son chemin de stockage à l'application (0012_creer_pieces_verification.sql, décision
// "pas même lui") — seuls type/dates en sortent.
export type TypePiece = 'identite' | 'diplome_ou_certification' | 'assurance_rc_pro';
export type PieceDeposee = { type: TypePiece; deposeLe: string };

// Table de référence `disciplines` (0020_creer_disciplines_reference.sql, `docs/domaine.md`
// §3.2bis) : `profils_coach.discipline` référence `cle` par clé étrangère depuis ce même lot —
// « Préparation physique » et « préparation physique » ne peuvent plus être deux valeurs
// distinctes. `cle` est la valeur stockée (et le filtre de recherche, L3), `libelle` est le
// texte affiché — les deux sont volontairement séparés : renommer un libellé ne touche jamais
// aux profils déjà écrits. Catalogue destiné à grandir (nouvelles lignes), jamais une énumération
// SQL figée.
export type Discipline = { cle: string; libelle: string };

// Table de référence `langues` (0025_creer_langues_reference_et_communes_fkey.sql, L1-09) :
// `profils_coach.langues` (text[]) ne peut pas porter une clé étrangère standard Postgres sur
// une colonne tableau -- un déclencheur vérifie la même chose à chaque écriture (même garantie
// que `disciplines`, mécanisme différent). Même séparation cle/libelle, même raison.
export type Langue = { cle: string; libelle: string };

// Référentiel géographique réduit (docs/ecrans/L3-02-recherche-filtres.md, « Référentiel
// géographique ») : six communes, pas le référentiel INSEE national — le filtre de commune de
// L3-02 est donc un choix fermé parmi ces lignes, jamais un champ texte libre. Table
// `communes_reference` (0023_creer_recherche_coachs.sql), coordonnées non exposées ici : le
// calcul de proximité vit entièrement côté serveur (`rechercher_coachs`), l'application n'a
// besoin que de la liste des choix proposables.
export type CommuneReference = { codeInsee: string; nom: string };

// L3-02 : ce qu'une carte de résultat affiche, une ligne par OFFRE publiée (jamais par coach —
// un coach avec deux offres publiées apparaît deux fois, docs/domaine.md §3.3). Jamais de note,
// jamais d'avis (docs/domaine.md §5.1/§5.6) : rechercher_coachs() ne les rend pas, il n'y a rien
// à retirer ici.
export type ResultatCoachRecherche = {
  offreId: string;
  coachId: string;
  prenom: string;
  nom: string;
  photoUrl: string | null;
  discipline: string;
  titreCourt: string | null;
  communeBaseInsee: string | null;
  formats: string[];
  titre: string;
  prixCentimes: number;
};

// Paramètres de rechercher_coachs() (0023_creer_recherche_coachs.sql) — un à un les mêmes que la
// fonction SQL, jamais un sous-ensemble deviné. `discipline` ET `texte` s'excluent en pratique
// (docs/ecrans/L3-02.md, Règles : discipline choisie = filtre exact ; texte seul = recherche
// libre) mais le port ne l'impose pas, c'est à l'écran de ne jamais envoyer les deux à la fois.
export type ParametresRecherche = {
  discipline?: string | null;
  texte?: string | null;
  communeInsee?: string | null;
  format?: 'visio' | 'presentiel' | null;
  prixMinCentimes?: number | null;
  prixMaxCentimes?: number | null;
  limite?: number;
  decalage?: number;
};

// `totalResultats` vient du champ que la fonction rend (count(*) over(), déjà calculé sur
// l'ensemble complet avant que le plafond ne tronque) — jamais reconstruit côté client par
// comptage de pages (docs/backend.md §10, décision validée de L3-02).
export type ResultatRecherche = {
  resultats: ResultatCoachRecherche[];
  totalResultats: number;
};

// L2-15/L2-10 : docs/domaine.md §3.3. Une seule nature d'offre au jalon 1 — pas de champ type.
export type Offre = {
  id: string;
  titre: string;
  description: string | null;
  prixCentimes: number;
  benefices: string[];
  engagementHumain: string[];
  estMiseEnAvant: boolean;
  publieeLe: string | null;
  retireeLe: string | null;
};

export type ModificationsOffre = {
  titre: string;
  description: string | null;
  prixCentimes: number;
  benefices: string[];
  engagementHumain: string[];
  estMiseEnAvant: boolean;
};

// L2-12/13/14 : lecture PUBLIQUE (anon compris, docs/backend.md §8) — jamais compte_id, jamais
// une offre non publiée d'un autre coach. `verifiee` gouverne l'affichage du badge, pas l'accès :
// un coach non vérifié reste consultable (docs/domaine.md §4.2, "préparer et être consultable").
export type ProfilCoachPublic = {
  id: string;
  prenom: string;
  nom: string;
  photoUrl: string | null;
  discipline: string;
  titreCourt: string | null;
  bio: string | null;
  verifiee: boolean;
  // Date à laquelle statutVerification est PASSÉ à 'verifiee' pour la dernière fois — jamais
  // le premier dépôt de dossier (docs/domaine.md §5.1, révisé le 12 septembre 2026 : affiché à
  // la place de la note pour un coach sans avis). `null` si `verifiee` est faux. Source :
  // date_verification_coach() (0019_creer_date_verification_publique.sql), une fonction
  // SECURITY DEFINER étroite — decisions_verification reste par ailleurs verrouillée à
  // l'examinateur (0015), jamais une lecture directe de la table.
  verifieeDepuisLe: string | null;
  parcoursTexte: string | null;
  langues: string[];
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

  // docs/ecrans/L1-08-activation-espace-coach.md : appelle la fonction de base
  // creer_profil_coach (0005, SECURITY DEFINER). Création ATOMIQUE — profil coach inséré ET
  // profil actif passé à 'coach', ou rien. prenom/nom sont fournis par l'appelant : repris du
  // profil client s'il existe, sinon saisis à l'écran. Change EtatProfils côté serveur (le
  // profil coach n'existait pas au dernier lireEtatProfils) : jamais appelée depuis un écran,
  // seulement par FournisseurDonnees, qui relit l'état juste après (voir PortDonneesLecture
  // plus bas et CLAUDE.md §8).
  creerProfilCoach(donnees: {
    discipline: string;
    telephone: string;
    prenom: string;
    nom: string;
  }): Promise<ResultatEcriture>;

  // docs/ecrans/L1-06-bascule-espace.md : appelle la fonction de base basculer_profil(profil)
  // (0002_politiques.sql, SECURITY DEFINER — comptes.profil_actif n'a aucun GRANT UPDATE pour
  // authenticated). Vérifie elle-même que le profil demandé existe pour ce compte ; refuse
  // sinon. L'application n'écrit JAMAIS profil_actif directement — cette méthode est le seul
  // chemin, et son résultat ne sert qu'à savoir si la bascule a eu lieu, jamais à décider un
  // droit (le champ profilActif rechargé ensuite ne sert que le routage et la palette). Change
  // EtatProfils côté serveur : passe par FournisseurDonnees comme creerProfilCoach ci-dessus.
  basculerProfil(profil: ProfilActif): Promise<ResultatEcriture>;

  // docs/ecrans/L1-09-mes-informations.md, « Mes informations ». Lit et écrit le profil ACTIF
  // (profils_client ou profils_coach selon comptes.profil_actif). enregistrerInformations ne
  // touche que les colonnes accordées en UPDATE pour ce lot — jamais date_naissance
  // (protégée), jamais discipline (P1.14). Le prénom/nom du profil actif est aussi
  // EtatProfils.identiteActive : cette écriture change donc EtatProfils, et passe par
  // FournisseurDonnees comme les deux au-dessus. lireInformations, elle, reste appelable
  // directement.
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

  // L2-09 : statut du dossier + motif de la dernière décision, pour l'écran d'attente.
  lireDossierVerification(): Promise<DossierVerification>;

  // L2-06 : les pièces déjà déposées par le coach courant (métadonnées seules, jamais le
  // fichier — 0012_creer_pieces_verification.sql).
  lirePiecesDeposees(): Promise<PieceDeposee[]>;

  // L2-06 : dépôt d'UNE pièce, de bout en bout — URL signée à usage unique (docs/api.md §4),
  // envoi du fichier, puis ligne de métadonnées. Le fichier ne transite jamais par ce port lui-
  // même (il part directement vers Supabase Storage) ni par aucune route applicative.
  deposerPieceVerification(
    type: TypePiece,
    fichier: { uri: string; nom: string; typeMime: string },
  ): Promise<ResultatEcriture>;

  // L2-15/L2-11 : offres du coach courant, brouillons compris (lecture propriétaire).
  lireMesOffres(): Promise<Offre[]>;
  creerOffreBrouillon(
    modifs: ModificationsOffre,
  ): Promise<{ succes: true; id: string } | { succes: false; erreur: string }>;
  modifierOffre(id: string, modifs: ModificationsOffre): Promise<ResultatEcriture>;
  // Textes exacts des deux refus possibles (docs/api.md §5) : 'coach_non_verifie' |
  // 'engagement_humain_requis' — l'écran choisit son propre libellé à partir du code.
  publierOffre(id: string): Promise<{ succes: true } | { succes: false; code: string }>;
  retirerOffre(id: string): Promise<ResultatEcriture>;

  // L2-12/13/14 : lecture publique (anon compris), jamais authentifiée. null si le coach
  // n'existe pas ou si son compte est supprimé.
  lireProfilCoachPublic(coachId: string): Promise<ProfilCoachPublic | null>;
  lireOffresPublieesDeCoach(coachId: string): Promise<Offre[]>;

  // L1-08/L3 : le catalogue de disciplines (voir `Discipline`). Lecture publique (anon compris,
  // comme les communes de L3-02) — actives seulement, triées par ordre_affichage. Remplace
  // l'import direct de `disciplinesCoach` (`src/fixtures/demonstration.ts`, retiré le 13
  // septembre 2026 : une règle métier n'a rien à faire dans un jeu de démonstration figé).
  lireDisciplines(): Promise<Discipline[]>;

  // L3-02 : le référentiel de communes réduit (voir `CommuneReference`). Lecture publique.
  lireCommunesReference(): Promise<CommuneReference[]>;

  // L1-09 (coach) : le catalogue de langues (voir `Langue`). Lecture publique, même mécanisme
  // que lireDisciplines — actives seulement, triées par ordre_affichage.
  lireLangues(): Promise<Langue[]>;

  // L3-01/L3-02 : rechercher_coachs() (0023_creer_recherche_coachs.sql), security invoker,
  // douze cycles casser/restaurer (docs/prompts/L3.md, P3.3). Lecture publique (anon compris) —
  // jamais authentifiée, jamais personnalisée à ce lot.
  rechercherCoachs(parametres: ParametresRecherche): Promise<ResultatRecherche>;

  // L2-01 (C-03) : appelle supprimer_mon_compte() (0018, SECURITY DEFINER) — comptes.supprime_le
  // n'a aucun GRANT UPDATE, comme profil_actif/statut_verification. L'écran vide ensuite la
  // session lui-même (port.deconnecter(), src/services/auth/) : ce port ne s'en charge pas, il
  // n'est pas le port d'authentification.
  demanderSuppressionCompte(motif: string | null): Promise<ResultatEcriture>;

  // L2-02 (C-04) : même mécanisme que enregistrerConsentementSante/lireConsentementSante — un
  // second type de journal (`consentements.type = 'communicationsCommerciales'`), jamais une
  // méthode générique paramétrée par type (le port reste un type par consentement, comme il
  // l'était déjà pour la santé).
  lireConsentementCommunications(): Promise<{ accorde: boolean; version: string | null }>;
  enregistrerConsentementCommunications(
    accorde: boolean,
    version: string,
  ): Promise<ResultatEcriture>;

  // L2-02, "Historique de mes décisions" : le journal complet (les deux types), le plus récent
  // en premier — lecture seule, jamais un point d'écriture.
  lireHistoriqueConsentements(): Promise<
    { type: string; accorde: boolean; version: string; horodatage: string }[]
  >;

  // L2-04 (C-07) : demander_export_donnees() (0018) applique la règle "un export par mois
  // maximum" côté serveur, jamais côté écran — l'écran ne fait que relire l'état après. Aucune
  // transition automatique vers "prêt" à ce lot (docs/dette.md) : rien ne la produirait pour de
  // vrai, ce port ne prétend pas le contraire.
  demanderExportDonnees(): Promise<{ succes: true } | { succes: false; code: string }>;
  lireDernierExport(): Promise<{
    demandeLe: string;
    pretLe: string | null;
    urlTelechargement: string | null;
    expireLe: string | null;
    tailleOctets: number | null;
  } | null>;

  // L2-03 (C-06) : cguVersionAcceptee et creeLe viennent tous deux de comptes (0001), déjà
  // lisibles par comptes_select_soi (0002) — aucune nouvelle politique. creeLe sert de date
  // « acceptée le » pour les CGU/CGV : comptes ne porte aucune colonne dédiée à la date
  // d'acceptation elle-même, seulement à sa version — exact tant qu'aucune ré-acceptation n'a
  // eu lieu depuis la création du compte (docs/dette.md).
  lireDatesDocuments(): Promise<{ cguVersionAcceptee: string; creeLe: string }>;
};

// Les trois écritures qui changent EtatProfils. Elles ne sont JAMAIS appelées sur un `port`
// brut depuis un écran : FournisseurDonnees les enveloppe pour relire l'état juste après
// (CLAUDE.md §8, « Le rafraîchissement de l'état appartient au fournisseur »). Trois oublis en
// trois prompts (P1.13→P1.15) : tant que rafraîchir restait une politesse à se rappeler, il y
// avait un oubli de plus.
export type EcritureEtatProfils = 'creerProfilCoach' | 'basculerProfil' | 'enregistrerInformations';

// Ce qu'un écran atteint par useDonnees().port : tout PortDonnees SAUF ces trois écritures.
// Un écran qui écrit `port.basculerProfil(...)` ne compile pas ; un balayage
// (src/test/ecriture-etat-profils-passe-par-le-fournisseur.test.ts) ferme le contournement par
// `as`.
export type PortDonneesLecture = Omit<PortDonnees, EcritureEtatProfils>;
