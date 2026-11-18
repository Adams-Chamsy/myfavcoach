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
  compteACompleter?: true;
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
  // Date de SOUMISSION du dossier (profils_coach.dossier_soumis_le, 0053), d'où part le délai de
  // 48 h ouvrées : posée au passage en examen, inchangée au remplacement d'une pièce ou au retour
  // d'un complément (docs/domaine.md §4.2). null tant que le dossier n'a jamais été soumis.
  deposeLe: string | null;
  motif: string | null;
};

// L2-06 : les trois types fermés du dossier (docs/domaine.md §4.2). Une pièce déposée n'expose
// jamais son chemin de stockage à l'application (0012_creer_pieces_verification.sql, décision
// "pas même lui") — seuls type/dates en sortent.
export type TypePiece = 'identite' | 'diplome_ou_certification' | 'assurance_rc_pro';
// nomFichier, tailleOctets (L2-06, 0056/0057, 12 novembre 2026) : null pour une pièce déposée
// avant cette date. Jamais dans un journal (fiche L2-06, critère 7).
export type PieceDeposee = {
  type: TypePiece;
  deposeLe: string;
  nomFichier?: string | null;
  tailleOctets?: number | null;
};

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

// L3bis (docs/domaine.md §3.15) : ce qu'un coach lit de SES invitations aux états
// compte_cree/abonnee — prénom + initiale du nom, jamais plus (docs/backend.md §11). Les
// invitations en_attente n'ont pas de représentation ici : elles ne sortent jamais
// individuellement, seulement comptées (voir lireNombreInvitationsEnAttente).
export type Invitation = {
  id: string;
  statut: 'compte_cree' | 'abonnee';
  prenom: string;
  initialeNom: string;
  abonneeLe: string | null;
};

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

// L4 (docs/api.md §1, règle du 31 octobre 2026) : un refus du serveur, AFFICHABLE TEL QUEL.
// L'écran montre `title` et `detail`, et branche son comportement sur `code`, jamais sur le texte.
// Les textes vivent côté serveur (supabase/functions/_partage/refus.ts), source unique.
export type RefusServeur = { code: string; title: string; detail: string };

// Mêmes trois issues que ResultatIntention : la publication a eu lieu, le serveur a refusé avec
// son texte, ou aucune réponse exploitable n'est arrivée.
export type ResultatPublicationOffre =
  { issue: 'publiee' } | { issue: 'refusee'; refus: RefusServeur } | { issue: 'sans_reponse' };

// docs/api.md §7, « Intention » : tout vient du serveur, rien n'est calculé par l'application.
export type RecapitulatifIntention = {
  prixCentimes: number;
  totalCentimes: number;
  prochainPrelevementLe: string;
  jourPrelevement: number;
};

// Trois issues, jamais confondues :
// - `creee` : la page de paiement existe ;
// - `refusee` : le serveur a répondu non, avec son texte ;
// - `sans_reponse` : aucune réponse exploitable n'est arrivée (réseau). Seul cas où l'écran
//   écrit son propre texte : le serveur ne peut rien dire d'une requête qu'il n'a pas reçue.
export type ResultatIntention =
  | {
      issue: 'creee';
      intentionId: string;
      recapitulatif: RecapitulatifIntention;
      urlPaiement: string;
      moyensAcceptes: ('carte' | 'sepa')[];
    }
  | { issue: 'refusee'; refus: RefusServeur }
  | { issue: 'sans_reponse' };

// docs/api.md §7, « Constat » : seul le serveur conclut, jamais l'écran.
export type ResultatConstat =
  // `abonnementId` (étape serveur de L4) : ce que 04c lit par lireDetailAbonnement.
  | { issue: 'constat'; etat: 'abonne'; statutAbonnement: string; abonnementId: string }
  | { issue: 'constat'; etat: 'non_terminee'; urlPaiement: string }
  | { issue: 'constat'; etat: 'paiement_recu' | 'expiree' | 'souscription_impossible' }
  | { issue: 'refusee'; refus: RefusServeur }
  | { issue: 'sans_reponse' };

// L4-24b, « Mes abonnements » (12 novembre 2026) : la lecture du client sur SES abonnements
// (abonnements_select_client, 0033 ; colonnes accordées, jamais reference_paiement), avec le
// titre de l'offre et le nom du coach embarqués. Toutes les dates viennent du serveur. Coach ou
// offre devenus illisibles (coach écarté, offre retirée) : null, l'écran n'invente rien.
export type StatutAbonnement =
  | 'en_attente_confirmation'
  | 'actif'
  | 'en_pause'
  | 'impaye'
  | 'suspendu'
  | 'resiliation_programmee'
  | 'resilie'
  | 'annule';

export type AbonnementClient = {
  id: string;
  coachPrenom: string | null;
  coachNom: string | null;
  offreTitre: string | null;
  prixFigeCentimes: number;
  statut: StatutAbonnement;
  prochainPrelevementLe: string | null;
  pauseJusquLe: string | null;
  finAccesLe: string | null;
};

// Les transitions du client (0033) : demander_resiliation, annuler_resiliation,
// reprendre_abonnement. Le serveur tranche ; un refus porte son code (`transition_interdite`…).
export type TransitionAbonnement = 'resilier' | 'annuler_resiliation' | 'reprendre';
export type ResultatTransition = { succes: true } | { succes: false; code: string };

// Étape serveur de L4 (0060, detail_abonnement) : ce que 04c, l'écran 20 et 24b lisent d'UN
// abonnement du client. Toutes les dates et tous les montants viennent du serveur (docs/api.md
// §15) : la fin de la période de grâce, la date limite de régularisation, la prochaine tentative.
// Les quatre derniers chiffres sont posés par le serveur depuis le prestataire, jamais par
// l'application (docs/ecrans/L4-04c-confirmation-abonnement.md).
export type MotifBanque =
  | 'fonds_insuffisants'
  | 'carte_expiree'
  | 'opposition'
  | 'plafond_atteint'
  | 'authentification_echouee'
  | 'inconnu';

export type DetailAbonnement = {
  id: string;
  statut: StatutAbonnement;
  moyen: 'carte' | 'sepa';
  moyenDerniersChiffres: string | null;
  prixFigeCentimes: number;
  prochainPrelevementLe: string | null;
  pauseJusquLe: string | null;
  finAccesLe: string | null;
  coachId: string;
  offreId: string;
  offreTitre: string;
  offreEngagementHumain: string[];
  coachPrenom: string;
  coachNom: string;
  coachCommuneBase: string | null;
  derniereFactureMontantCentimes: number | null;
  derniereFacturePayeeLe: string | null;
  dernierEchecMotif: MotifBanque | null;
  dernierEchecEcheanceLe: string | null;
  // impaye : dernier jour de suivi avant la suspension (J+6).
  graceJusquAu: string | null;
  // suspendu : le jour où l'abonnement devient résilié (J+37).
  regularisationAvantLe: string | null;
  prochaineTentativeLe: string | null;
  // Vrai tant qu'un nouveau moyen enregistré après le refus attend son essai (0063) : le moyen
  // affiché n'est alors plus celui que la banque a refusé.
  nouveauMoyenEnregistre: boolean;
};

// docs/api.md §7, POST /abonnements/{id}/moyen-paiement : la page du prestataire où enregistrer
// un nouveau moyen après un refus (écran 20). Mêmes trois issues que ResultatIntention.
export type ResultatNouveauMoyen =
  | { issue: 'creee'; urlPaiement: string }
  | { issue: 'refusee'; refus: RefusServeur }
  | { issue: 'sans_reponse' };

// Le constat au retour de cette page : seul le serveur conclut (relecture chez le prestataire).
export type ConstatNouveauMoyen =
  | { issue: 'constat'; etat: 'enregistre'; prochaineTentativeLe: string | null }
  | { issue: 'constat'; etat: 'non_terminee'; urlPaiement: string }
  | { issue: 'constat'; etat: 'expiree' | 'aucune' }
  | { issue: 'refusee'; refus: RefusServeur }
  | { issue: 'sans_reponse' };

// La pause (0059) : demandée en JOURS, la date de fin est calculée par le serveur à la date de
// Paris — jamais par le téléphone (docs/domaine.md §4.3). Le refus `pause_deja_utilisee` porte le
// premier jour où une nouvelle pause sera acceptée (AAAA-MM-JJ) ; null pour les autres refus.
export type ResultatPause =
  { succes: true } | { succes: false; code: string; possibleLe: string | null };

// L4, avis (P4.9a ; docs/domaine.md §3.11, §5.1 ; docs/ecrans/L2-13-avis.md, L4-27a-depot-avis.md).
// Tout est calculé par le serveur : la durée de suivi (jamais une date), la moyenne (à partir de 5
// avis publiés seulement, sinon null), l'éligibilité et le nombre de jours restants.
export type EtiquetteAvis = { cle: string; libelle: string };

export type AvisPublic = {
  id: string;
  prenom: string;
  initialeNom: string | null;
  dureeSuiviMois: number;
  note: number;
  // Clés de etiquettes_avis, dans leur ordre d'affichage.
  etiquettes: string[];
  texte: string | null;
};

export type SyntheseAvis = {
  nombre: number;
  moyenne: number | null;
  // Nombre d'avis par note, de 1 à 5 étoiles.
  distribution: number[];
  // Les étiquettes portées par au moins un avis publié : le filtre de L2-13.
  etiquettesPortees: string[];
};

export type AvisDuCoach = { avis: AvisPublic[]; synthese: SyntheseAvis };

export type MonAvis = {
  note: number;
  etiquettes: string[];
  texte: string | null;
  statut: 'publie' | 'signale' | 'masque';
};

// L'état du client connecté pour ce coach (27a, 27b). `aucun` : ni encart ni bouton.
// `dureeSuiviMois` (0061) : « Suivi depuis {durée} » de 27a, calculée par le serveur comme sous
// chaque avis ; présente dès qu'un abonnement fonde l'état.
export type EtatMonAvis =
  | { etat: 'aucun' | 'suivi_interrompu' }
  | { etat: 'possible'; dureeSuiviMois: number }
  | { etat: 'pas_encore'; joursRestants: number }
  | { etat: 'modifiable' | 'fige'; avis: MonAvis; dureeSuiviMois: number };

export type SaisieAvis = { note: number; etiquettes: string[]; texte: string | null };

// Mêmes trois issues que ResultatIntention : le refus porte son texte, l'absence de réponse est
// le seul cas où l'écran écrit le sien.
export type ResultatAvis =
  | { issue: 'enregistre'; avisId: string }
  | { issue: 'refusee'; refus: RefusServeur }
  | { issue: 'sans_reponse' };

// L5 (docs/api.md §8, docs/ecrans/L5-13-revenus.md, L5-C05-factures-recus.md). Tout vient du
// serveur : nets, solde, dates, HT et TVA. L'écran ne calcule rien.
export type EtatCompteVersement =
  'absent' | 'a_completer' | 'en_verification' | 'operationnel' | 'restreint';

export type Identification = {
  compteVersement: EtatCompteVersement;
  identiteFiscaleComplete: boolean;
  peutPublier: boolean;
};

export type IdentiteFiscale = {
  siren: string;
  adresseLigne: string;
  codePostal: string;
  commune: string;
  regimeTva: 'franchise_en_base' | 'assujetti';
  tauxTvaPourMille: number | null;
};

export type Solde = {
  soldeCentimes: number;
  versementEnCours: boolean;
  prochainVersementLe: string;
  compteOperationnel: boolean;
};

export type StatutVersement = 'prevu' | 'en_cours' | 'verse' | 'echoue';

export type Versement = {
  id: string;
  montantCentimes: number;
  fraisCentimes: number;
  mode: 'mensuel' | 'immediat';
  statut: StatutVersement;
  emisLe: string;
  verseLe: string | null;
};

export type RevenusMois = {
  // Premier jour du mois, AAAA-MM-JJ.
  mois: string;
  encaissementsCentimes: number;
  nombrePaiements: number;
  commissionCentimes: number;
  netCentimes: number;
};

export type FactureResume = {
  id: string;
  numero: string;
  libelle: string;
  // Le coach (lu par le client) ou le client (lu par le coach).
  autrePartie: string;
  periodeDu: string;
  periodeAu: string;
  montantTtcCentimes: number;
  // null pour le client : la commission ne le regarde pas.
  commissionCentimes: number | null;
  payeeLe: string;
};

export type FactureDetail = {
  numero: string;
  emiseLe: string;
  payeeLe: string;
  vendeurPrenom: string;
  vendeurNom: string;
  vendeurSiren: string | null;
  vendeurAdresse: string | null;
  vendeurRegimeTva: 'franchise_en_base' | 'assujetti' | null;
  vendeurTauxTvaPourMille: number | null;
  clientPrenom: string;
  clientNom: string | null;
  libelle: string;
  periodeDu: string;
  periodeAu: string;
  montantTtcCentimes: number;
  montantHtCentimes: number | null;
  tvaCentimes: number | null;
  commissionCentimes: number | null;
};

// L5, P5.6b — le rappel de commission de I-01 (mon_rappel_commission, 0078). null : pas de
// rappel (commission plus offerte, ou aucun abonnement actif venu d'un lien du coach).
export type RappelCommission = {
  commissionOfferteJusquLe: string;
  nombreAbonnements: number;
  totalCentimes: number;
  totalApresCommissionCentimes: number;
};

export type FactureCommission = {
  id: string;
  numero: string;
  mois: string;
  montantTtcCentimes: number;
  nombreLignes: number;
  emiseLe: string;
};

// Mêmes trois issues que ResultatIntention : le refus porte son texte, l'absence de réponse est
// le seul cas où l'écran écrit le sien.
export type ResultatServeur<T> =
  ({ issue: 'ok' } & T) | { issue: 'refusee'; refus: RefusServeur } | { issue: 'sans_reponse' };

// L6 — le studio du coach (docs/ecrans/L6-11-studio.md ; docs/prompts/L6.md). Toute écriture
// passe par une fonction du serveur ; un refus rend son code (programme_vide, …), que l'écran
// traduit (src/fonctionnalites/studio/textes.ts). « sans_reponse » : pas de réponse du tout.
export type ResultatStudio<T = null> =
  { issue: 'ok'; valeur: T } | { issue: 'refusee'; code: string } | { issue: 'sans_reponse' };

export type StatutProgramme = 'brouillon' | 'publie' | 'archive';

export type ProgrammeResume = {
  id: string;
  titre: string;
  dureeSemaines: number;
  statut: StatutProgramme;
  nombreSeances: number;
  abonnesEnCours: number;
};

export type SeanceResume = {
  id: string;
  titre: string;
  dureeMinutes: number;
  // Le jour dans le programme, à partir de 1 (docs/domaine.md §3.6).
  jourRelatif: number;
  nombreExercices: number;
};

export type MediaJoint = { id: string; chemin: string; typeMime: string; nomFichier: string };

export type ExerciceProgramme = {
  id: string;
  ordre: number;
  nom: string;
  series: number | null;
  repetitions: number | null;
  chargeGrammes: number | null;
  consigne: string;
  media: MediaJoint | null;
};

export type SaisieExercice = {
  nom: string;
  series: number | null;
  repetitions: number | null;
  chargeGrammes: number | null;
  consigne: string;
};

export type MediaBibliotheque = MediaJoint & { poidsOctets: number };

export type AbonneAffectable = { profilClientId: string; prenom: string; initialeNom: string };

// L7 — les mesures corporelles du client (docs/domaine.md §3.7 ; docs/ecrans/L7-06-suivi.md).
// Donnée de santé : jamais journalisée, jamais gardée au-delà de l'écran qui la lit. Valeurs en
// kg et en cm, une décimale ; `le` : AAAA-MM-JJ, Europe/Paris, posé par le serveur. `ecart` :
// dernière moins première, calculé par le serveur. `seuils` : seuils de CONFIRMATION, rendus
// par le serveur ; ils ne refusent rien (le serveur n'en refuse que les saisies invalides).
export type TypeMesure = 'poids' | 'tour_de_taille';
export type PointMesure = { valeur: number; le: string };
export type SerieMesures = {
  premiere: PointMesure;
  derniere: PointMesure;
  ecart: number;
  nombre: number;
};
export type MesMesures = {
  poids: SerieMesures | null;
  tourDeTaille: SerieMesures | null;
  seuils: Record<TypeMesure, { min: number; max: number }>;
};

// L7 — le suivi du client (docs/domaine.md §5.2, §5.3 ; docs/ecrans/L7-06-suivi.md), calculé par
// le serveur sur les séances des coachs auxquels il a accès aujourd'hui. Aucune donnée de santé.
// `assiduite` : pourcentage entier, null sous 4 séances prévues (« — »). `semaines` : huit, la
// plus ancienne d'abord ; `lundi` AAAA-MM-JJ ; `faites` et `prevues` sont des entiers.
// `depuis` : la première séance prévue, null sans séance.
export type SemaineSuivi = { lundi: string; faites: number; prevues: number };
export type MonSuivi = {
  seancesFaites: number;
  depuis: string | null;
  assiduite: number | null;
  serie: number;
  semaines: SemaineSuivi[];
};

// L7 — les clients du coach (docs/ecrans/L7-08-pilotage.md, L7-09-clients.md,
// L7-10-fiche-client.md). Tout est calculé par le serveur, badge compris. AUCUNE donnée de
// santé (docs/prompts/L7.md, décision 1). `badgeN` : le nombre de séances non rattrapées, pour
// le seul badge `inactive`. Dates AAAA-MM-JJ, Europe/Paris.
export type BadgeClient = 'paiement_ko' | 'inactive' | 'nouveau' | 'a_jour';
export type StatutAbonnementClient =
  'actif' | 'resiliation_programmee' | 'impaye' | 'suspendu' | 'en_pause';
export type ClientDuCoach = {
  profilClientId: string;
  prenom: string;
  nom: string | null;
  offre: string;
  statut: StatutAbonnementClient;
  badge: BadgeClient;
  badgeN: number | null;
  semaine: number;
  semaineEnCours: SemaineSuivi;
  programmeEnCours: boolean;
  pauseJusquLe: string | null;
  finAccesLe: string | null;
};
export type MesClients = {
  clients: ClientDuCoach[];
  compteurs: { tous: number; aRelancer: number; nouveaux: number; anciens: number };
};
export type AncienClient = {
  profilClientId: string;
  prenom: string;
  nom: string | null;
  offre: string;
  debuteLe: string;
  finAccesLe: string;
};
export type SeanceHistorique = {
  id: string;
  titre: string;
  datePrevue: string;
  dureeMinutes: number;
  statut: StatutSeanceProgrammee;
  rattrapee: boolean;
  // Toujours null pour un ancien client (arbitrage en attente, L7-10).
  commentaire: string | null;
};
export type FicheClient =
  | {
      mode: 'actuel';
      profilClientId: string;
      prenom: string;
      nom: string | null;
      offre: string;
      statut: StatutAbonnementClient;
      prixCentimes: number;
      debuteLe: string;
      badge: BadgeClient;
      badgeN: number | null;
      derniereSeanceLe: string | null;
      seancesFaites: number;
      assiduite: number | null;
      semaines: SemaineSuivi[];
      programme: { id: string; titre: string; semaine: number; semaines: number } | null;
      historique: SeanceHistorique[];
      notes: string | null;
    }
  | {
      mode: 'ancien';
      profilClientId: string;
      prenom: string;
      nom: string | null;
      offre: string;
      debuteLe: string;
      finAccesLe: string;
      seancesFaites: number;
      historique: SeanceHistorique[];
    };
export type LigneATraiter = {
  profilClientId: string;
  prenom: string;
  nom: string | null;
  badge: 'paiement_ko' | 'inactive';
  badgeN: number | null;
};
// Sans revenu : l'écran lit lireRevenus (mes_revenus, L5), une seule définition du net.
export type Pilotage = {
  aucunClient: boolean;
  clientsAvecAcces: number;
  assiduiteMoyenne: number | null;
  aTraiterTotal: number;
  aTraiter: LigneATraiter[];
};

// L6 — la séance du jour du client (docs/ecrans/L6-05-seance-du-jour.md), en espace client.
export type StatutSeanceProgrammee = 'a_faire' | 'en_cours' | 'faite' | 'partielle' | 'manquee';

export type SeanceDuJour = {
  id: string;
  titre: string;
  dureeMinutes: number;
  nombreExercices: number;
  coachPrenom: string;
  coachNom: string;
  statut: StatutSeanceProgrammee;
};

export type SeancePlanning = Pick<
  SeanceProgrammeeDetail,
  'id' | 'titre' | 'dureeMinutes' | 'datePrevue' | 'coachPrenom' | 'coachNom'
> & { aRattraperAvant: string | null };

export type SeanceProgrammeeDetail = {
  id: string;
  titre: string;
  dureeMinutes: number;
  datePrevue: string;
  statut: StatutSeanceProgrammee;
  demarreeLe: string | null;
  rattrapee: boolean;
  coachPrenom: string;
  coachNom: string;
};

export type ExerciceDeSeance = {
  id: string;
  ordre: number;
  nom: string;
  series: number | null;
  repetitions: number | null;
  chargeGrammes: number | null;
  consigne: string;
  mediaChemin: string | null;
  mediaTypeMime: string | null;
};

export type SerieSaisie = {
  exerciceId: string;
  numero: number;
  repetitions: number | null;
  chargeGrammes: number | null;
};

export type PortDonnees = {
  completerCompteSocial(dateNaissance: string, versionCgu: string): Promise<ResultatEcriture>;
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

  // Efface les mesures corporelles enregistrées : poids de départ et poids visé
  // (profils_client, L1) ET les mesures datées (mesures_corporelles, L7), par la fonction du
  // serveur effacer_mes_mesures (0089), permise consentement retiré. Irréversible, offert
  // seulement après un retrait de consentement. Les clés de réessai restent (sans valeur) :
  // un réessai arrivé après l'effacement ne recrée rien.
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
  // docs/api.md §5, POST /coach/offres/{id}/publication (fonction offre-publication, P4.11) : le
  // serveur décide et rend son refus avec son titre et son détail ; l'écran les affiche tels quels.
  publierOffre(id: string): Promise<ResultatPublicationOffre>;
  retirerOffre(id: string): Promise<ResultatEcriture>;

  // L2-12/13/14 : lecture publique (anon compris), jamais authentifiée. null si le coach
  // n'existe pas ou si son compte est supprimé.
  lireProfilCoachPublic(coachId: string): Promise<ProfilCoachPublic | null>;
  lireOffresPublieesDeCoach(coachId: string): Promise<Offre[]>;
  lireMesCoachsSuivis(): Promise<Pick<ProfilCoachPublic, 'id' | 'prenom' | 'nom' | 'discipline'>[]>;
  definirSuiviCoach(coachId: string, suivre: boolean): Promise<void>;

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

  // L3bis-I01 : le jeton d'invitation du coach courant (mon_jeton_invitation, 0026). Lecture
  // pour SON PROPRE coach seulement — jamais accordée à quiconque d'autre (docs/backend.md §8 :
  // toute colonne de profils_coach est publique dès qu'elle est accordée, jeton_invitation n'a
  // donc jamais de grant, cette fonction est le seul chemin).
  lireMonJetonInvitation(): Promise<string>;

  // L3bis-I01 : remplace le jeton du coach courant (regenerer_jeton_invitation, 0026). Ne touche
  // à aucune ligne invitations — seule la valeur du jeton change.
  regenererJetonInvitation(): Promise<string>;

  // L3bis-I01 : les invitations du coach courant aux états compte_cree/abonnee (mes_invitations,
  // 0027) — colonnes exactes, docs/ecrans/L3bis-I01-inviter-mes-clients.md, « Colonnes rendues ».
  lireMesInvitations(): Promise<Invitation[]>;

  // L3bis-I01 : le compte agrégé des invitations en_attente
  // (nombre_invitations_en_attente, 0029) — jamais les lignes elles-mêmes, qui ne fuient jamais
  // individuellement (docs/prompts/L3bis.md, P3bis.4).
  lireNombreInvitationsEnAttente(): Promise<number>;

  // L3bis-I01, « Ajouter » (ajouter_invitation_en_attente, 0029) : incrémente le compte
  // en_attente de un. Aucun paramètre, aucune identité capturée (docs/ecrans/L3bis-I01-
  // inviter-mes-clients.md, Règles).
  ajouterInvitationEnAttente(): Promise<ResultatEcriture>;

  // L3bis-I02 : résout un jeton public vers un coach_id (coach_par_jeton_invitation, 0027).
  // Lecture publique (anon compris) — null si le jeton ne résout à rien (absent, régénéré, ou
  // coach non vérifié), jamais une erreur : un jeton presque valide se comporte comme un jeton
  // absent (docs/ecrans/L3bis-I02-arrivee-par-invitation.md, Règles).
  lireCoachParJetonInvitation(jeton: string): Promise<string | null>;

  // L4-04a : POST /abonnements/intention (Edge Function abonnement-intention, docs/api.md §7).
  // `cleIdempotence` naît dans l'écran, une par appui sur « Continuer », réutilisée pour un nouvel
  // essai de la même demande après une absence de réponse (docs/backend.md §13). Jamais l'URL de
  // paiement dans un journal ni un stockage local (CLAUDE.md §10).
  demanderIntention(offreId: string, cleIdempotence: string): Promise<ResultatIntention>;

  // L4-04b (P4.6b) : POST /abonnements/intention/{id}/constat. L'identifiant peut venir de
  // l'adresse de retour, donc de l'extérieur : c'est le serveur qui décide s'il appartient au
  // compte connecté (docs/ecrans/L4-04b-recapitulatif-paiement.md), jamais l'application.
  constaterIntention(intentionId: string): Promise<ResultatConstat>;

  // L4-24b : mes abonnements, en espace client (0033). Une erreur de lecture lève.
  lireMesAbonnements(): Promise<AbonnementClient[]>;
  transitionAbonnement(
    abonnementId: string,
    transition: TransitionAbonnement,
  ): Promise<ResultatTransition>;
  demanderPause(abonnementId: string, jours: number): Promise<ResultatPause>;

  // Étape serveur de L4 : le détail d'UN abonnement (detail_abonnement, 0060), pour 04c, l'écran
  // 20 et 24b. L'identifiant peut venir d'une adresse : le serveur décide s'il est au compte
  // connecté. Une erreur de lecture lève.
  lireDetailAbonnement(abonnementId: string): Promise<DetailAbonnement>;
  // Écran 20 : la page où enregistrer un nouveau moyen de paiement, puis son constat au retour.
  demanderNouveauMoyen(abonnementId: string): Promise<ResultatNouveauMoyen>;
  constaterNouveauMoyen(abonnementId: string): Promise<ConstatNouveauMoyen>;

  // L4, avis (P4.9a). Lectures publiques (anon compris) : etiquettes_avis (table), avis_du_coach
  // et synthese_avis_du_coach (fonctions de base, 0049). Un coach non vérifié rend une liste vide.
  lireEtiquettesAvis(): Promise<EtiquetteAvis[]>;
  lireAvisDuCoach(coachId: string): Promise<AvisDuCoach>;
  // Compte connecté : mon_avis_possible (0049). Hors espace client : { etat: 'aucun' }.
  lireMonAvis(coachId: string): Promise<EtatMonAvis>;
  // Edge Function `avis` : POST pour un dépôt, PATCH pour une modification. Le serveur tranche
  // l'éligibilité, la forme et le délai de 14 jours ; l'écran affiche son refus tel quel.
  deposerAvis(coachId: string, saisie: SaisieAvis): Promise<ResultatAvis>;
  modifierAvis(coachId: string, saisie: SaisieAvis): Promise<ResultatAvis>;

  // L5, espace coach. L'état du compte de versement est relu chez le prestataire par la
  // fonction coach-identification ; une absence de réponse lève.
  lireIdentification(): Promise<Identification>;
  // La page d'inscription hébergée par le prestataire : à usage unique, jamais gardée.
  demanderLienIdentification(): Promise<ResultatServeur<{ url: string }>>;
  // null : rien d'enregistré.
  lireMonIdentiteFiscale(): Promise<IdentiteFiscale | null>;
  enregistrerIdentiteFiscale(saisie: IdentiteFiscale): Promise<ResultatServeur<object>>;
  lireSolde(): Promise<Solde>;
  lireVersements(): Promise<Versement[]>;
  // Le versement immédiat ; `statut` est l'état réel après la tentative de virement.
  demanderVersement(): Promise<ResultatServeur<{ statut: StatutVersement }>>;
  // Le mois de `mois` (AAAA-MM-JJ, n'importe quel jour) et les cinq précédents, du plus récent au
  // plus ancien.
  lireRevenus(mois: string): Promise<RevenusMois[]>;
  lireFacturesCommission(): Promise<FactureCommission[]>;
  lireRappelCommission(): Promise<RappelCommission | null>;

  // L5, C-05 : selon l'espace actif (client : ses achats ; coach : ses ventes). null : une
  // facture qui n'existe pas, ou qui n'est pas la sienne — même réponse.
  lireFactures(): Promise<FactureResume[]>;
  lireFacture(factureId: string): Promise<FactureDetail | null>;

  // L6, studio (écran 11), en espace coach.
  lireMesProgrammes(): Promise<ProgrammeResume[]>;
  creerProgramme(): Promise<ResultatStudio<string>>;
  modifierProgramme(id: string, titre: string, dureeSemaines: number): Promise<ResultatStudio>;
  lireSeancesDuProgramme(programmeId: string): Promise<SeanceResume[]>;
  ajouterSeance(programmeId: string, jourRelatif: number): Promise<ResultatStudio<string>>;
  modifierSeance(
    seanceId: string,
    modifs: { titre: string; dureeMinutes: number; jourRelatif: number },
  ): Promise<ResultatStudio>;
  supprimerSeance(seanceId: string): Promise<ResultatStudio>;
  dupliquerSemaine(programmeId: string, semaine: number): Promise<ResultatStudio<number>>;
  lireExercices(seanceId: string): Promise<ExerciceProgramme[]>;
  ajouterExercice(seanceId: string, saisie: SaisieExercice): Promise<ResultatStudio<string>>;
  supprimerExercice(exerciceId: string): Promise<ResultatStudio>;
  deplacerExercice(exerciceId: string, sens: 'haut' | 'bas'): Promise<ResultatStudio>;
  joindreMedia(exerciceId: string, mediaId: string | null): Promise<ResultatStudio>;
  publierProgramme(id: string): Promise<ResultatStudio>;
  archiverProgramme(id: string): Promise<ResultatStudio>;
  revenirEnEdition(id: string): Promise<ResultatStudio>;
  lireMesMedias(): Promise<MediaBibliotheque[]>;
  // Envoi dans le dossier privé du coach, puis enregistrement par le serveur (0083).
  deposerMedia(fichier: {
    uri: string;
    nom: string;
    typeMime: string;
    poidsOctets: number;
  }): Promise<ResultatStudio<string>>;
  supprimerMedia(mediaId: string): Promise<ResultatStudio>;
  // URL signée de 15 minutes ; null si le compte n'a pas le droit de lire ce média.
  urlMedia(chemin: string): Promise<string | null>;
  lireAbonnesAffectables(): Promise<AbonneAffectable[]>;
  affecterProgramme(
    programmeId: string,
    profilClientId: string,
    debut: string,
  ): Promise<ResultatStudio<number>>;

  // L6, séance du jour (écran 05), en espace client. Une séance d'un autre, ou sans accès :
  // la lecture lève (seance_introuvable, abonnement_sans_acces), l'écriture rend son refus.
  lireSeancesDuJour(): Promise<SeanceDuJour[]>;
  lireMonPlanningSeances(): Promise<SeancePlanning[]>;
  lireSeanceProgrammee(id: string): Promise<SeanceProgrammeeDetail>;
  lireExercicesDeMaSeance(id: string): Promise<ExerciceDeSeance[]>;
  lireSeriesDeMaSeance(id: string): Promise<SerieSaisie[]>;
  demarrerSeance(id: string): Promise<ResultatStudio>;
  enregistrerSerie(id: string, serie: SerieSaisie): Promise<ResultatStudio>;
  // Le ressenti est une donnée de santé : jamais journalisé, refusé sans consentement.
  terminerSeance(
    id: string,
    ressentiEffort: number | null,
    commentaire: string | null,
  ): Promise<ResultatStudio>;

  // L7, mesures corporelles (écran 06), en espace client. La lecture lève sans consentement
  // santé (consentement_sante_absent) ou hors espace client (profil_client_requis).
  // L'écriture rend son refus : mesure_invalide, consentement_sante_absent,
  // cle_idempotence_reutilisee. `cle` : un UUID tiré à l'appui sur « Enregistrer » et RENVOYÉ
  // tel quel en cas de réessai — c'est lui qui empêche un doublon après une coupure réseau.
  lireMesMesures(): Promise<MesMesures>;

  // L7, suivi (écran 06), en espace client ; lève hors espace client (profil_client_requis).
  lireMonSuivi(): Promise<MonSuivi>;

  // L7, clients du coach (écrans 08, 09, 10), en espace coach. Les lectures lèvent hors espace
  // coach (profil_coach_requis) ; lireFicheClient lève client_introuvable pour un client qui
  // n'est ni actuel ni ancien chez ce coach. enregistrerNotesClient rend son refus :
  // client_introuvable, client_ancien (lecture seule), notes_invalides (plus de 2 000
  // caractères). Un texte vide efface la note. Les notes ne passent jamais par un journal.
  lireMesClients(): Promise<MesClients>;
  lireMesAnciensClients(): Promise<AncienClient[]>;
  lireFicheClient(profilClientId: string): Promise<FicheClient>;
  enregistrerNotesClient(profilClientId: string, texte: string): Promise<ResultatStudio>;
  lirePilotage(): Promise<Pilotage>;
  enregistrerMesure(type: TypeMesure, valeur: number, cle: string): Promise<ResultatStudio<string>>;
};

// Les trois écritures qui changent EtatProfils. Elles ne sont JAMAIS appelées sur un `port`
// brut depuis un écran : FournisseurDonnees les enveloppe pour relire l'état juste après
// (CLAUDE.md §8, « Le rafraîchissement de l'état appartient au fournisseur »). Trois oublis en
// trois prompts (P1.13→P1.15) : tant que rafraîchir restait une politesse à se rappeler, il y
// avait un oubli de plus.
//
// Quatrième ajoutée le 2 novembre 2026 (option B) : creerProfilClient, qui active désormais
// l'espace client côté serveur (creer_profil_client, 0051).
export type EcritureEtatProfils =
  'creerProfilClient' | 'creerProfilCoach' | 'basculerProfil' | 'enregistrerInformations';

// Ce qu'un écran atteint par useDonnees().port : tout PortDonnees SAUF ces quatre écritures.
// Un écran qui écrit `port.basculerProfil(...)` ne compile pas ; un balayage
// (src/test/ecriture-etat-profils-passe-par-le-fournisseur.test.ts) ferme le contournement par
// `as`.
export type PortDonneesLecture = Omit<PortDonnees, EcritureEtatProfils>;
