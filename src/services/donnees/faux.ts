import type {
  ConstatNouveauMoyen,
  DetailAbonnement,
  ResultatNouveauMoyen,
  AvisDuCoach,
  CommuneReference,
  Discipline,
  DossierVerification,
  EtatMonAvis,
  EtatProfils,
  EtiquetteAvis,
  InformationsCompte,
  Invitation,
  Langue,
  ModificationsInformations,
  ModificationsOffre,
  Offre,
  ParametresRecherche,
  PieceDeposee,
  PortDonnees,
  ProfilCoachPublic,
  ProfilOnboarding,
  RefusServeur,
  ResultatAvis,
  FactureCommission,
  RappelCommission,
  AbonneAffectable,
  ExerciceProgramme,
  ExerciceDeSeance,
  MediaBibliotheque,
  ProgrammeResume,
  ResultatStudio,
  MesMesures,
  MonSuivi,
  MesClients,
  AncienClient,
  FicheClient,
  Pilotage,
  SerieMesures,
  TypeMesure,
  SeanceProgrammeeDetail,
  SerieSaisie,
  StatutProgramme,
  FactureDetail,
  FactureResume,
  Identification,
  IdentiteFiscale,
  ResultatServeur,
  RevenusMois,
  Solde,
  StatutVersement,
  Versement,
  ResultatPublicationOffre,
  ResultatConstat,
  ResultatEcriture,
  ResultatIntention,
  ResultatRecherche,
  SaisieAvis,
  TypePiece,
  AbonnementClient,
  StatutAbonnement,
  TransitionAbonnement,
} from './port';

// Mêmes sept clés que la migration 0020 (disciplines) — dupliquées ici volontairement : le faux
// port ne touche jamais Postgres, il ne peut donc pas les lire depuis la vraie table. Pas
// personnalisable par un `definirXPourTest` comme le reste de ce fichier : c'est un catalogue,
// pas un état de test à faire varier.
export const DISCIPLINES_FIGEES: Discipline[] = [
  { cle: 'préparation physique', libelle: 'Préparation physique' },
  { cle: 'yoga', libelle: 'Yoga' },
  { cle: 'nutrition', libelle: 'Nutrition et diététique' },
  { cle: 'cuisine', libelle: 'Cuisine et alimentation du quotidien' },
  { cle: 'cybersécurité', libelle: 'Cybersécurité' },
  { cle: 'RGPD', libelle: 'RGPD et protection des données' },
  { cle: 'développement professionnel', libelle: 'Développement professionnel' },
];

// Mêmes six villes que la migration 0023 (communes_reference) — même motif que
// DISCIPLINES_FIGEES ci-dessus : un catalogue, pas un état de test à faire varier.
export const COMMUNES_FIGEES: CommuneReference[] = [
  { codeInsee: '33063', nom: 'Bordeaux' },
  { codeInsee: '59350', nom: 'Lille' },
  { codeInsee: '69123', nom: 'Lyon' },
  { codeInsee: '44109', nom: 'Nantes' },
  { codeInsee: '75056', nom: 'Paris' },
  { codeInsee: '31555', nom: 'Toulouse' },
];

// Mêmes sept clés que la migration 0025 (langues) — même motif que DISCIPLINES_FIGEES ci-dessus.
export const LANGUES_FIGEES: Langue[] = [
  { cle: 'français', libelle: 'Français' },
  { cle: 'anglais', libelle: 'Anglais' },
  { cle: 'espagnol', libelle: 'Espagnol' },
  { cle: 'allemand', libelle: 'Allemand' },
  { cle: 'italien', libelle: 'Italien' },
  { cle: 'arabe', libelle: 'Arabe' },
  { cle: 'portugais', libelle: 'Portugais' },
];

// docs/domaine.md §3.11 : la liste fermée des huit, dans l'ordre d'affichage (même contenu que
// 0048_creer_avis.sql).
export const ETIQUETTES_AVIS_FIGEES: EtiquetteAvis[] = [
  { cle: 'ecoute', libelle: 'Écoute' },
  { cle: 'clarte_explications', libelle: 'Clarté des explications' },
  { cle: 'ponctualite', libelle: 'Ponctualité' },
  { cle: 'exigence', libelle: 'Exigence' },
  { cle: 'programme_adapte', libelle: 'Programme adapté' },
  { cle: 'reactivite', libelle: 'Réactivité' },
  { cle: 'encouragement', libelle: 'Encouragement' },
  { cle: 'professionnalisme', libelle: 'Professionnalisme' },
];

// L'état de tous les profils au lancement (L2-13, critère 1) : aucun avis.
export const AUCUN_AVIS: AvisDuCoach = {
  avis: [],
  synthese: { nombre: 0, moyenne: null, distribution: [0, 0, 0, 0, 0], etiquettesPortees: [] },
};

export type FauxPortDonnees = PortDonnees & {
  // Réservé aux tests d'écran, jamais dans PortDonnees ni appelé par un écran — même
  // convention que src/services/auth/faux.ts (verifierEmailPourTest, etc.) : place un compte
  // dans un état donné sans passer par un vrai onboarding ou une vraie bascule d'espace.
  definirEtatProfilsPourTest(etat: EtatProfils): void;

  // Place le contenu de « Mes informations » (docs/ecrans/L1-09) dans un état donné, sans
  // rejouer une écriture. La date de naissance et, côté coach, la discipline n'ont pas d'autre
  // source dans ce faux : elles viennent d'ici.
  definirInformationsPourTest(informations: InformationsCompte): void;

  // Place l'état courant du consentement santé (docs/ecrans/L1-09, « Confidentialité »).
  definirConsentementSantePourTest(etat: { accorde: boolean; version: string | null }): void;

  // Fait échouer le PROCHAIN appel d'écriture (creerProfilClient, enregistrerObjectifsEtRythme,
  // enregistrerPointDeDepart, terminerOnboarding), un seul coup, puis revient au succès —
  // aucune règle métier naturelle (mot de passe erroné, etc.) n'existe côté écriture de profil
  // pour déclencher un échec organiquement, contrairement à src/services/auth/faux.ts. Sert
  // l'état "Erreur" de docs/ecrans/L1-05 (critère : "l'étape n'avance pas et rien n'est perdu").
  echouerProchaineEcriturePourTest(erreur?: string): void;

  definirDossierVerificationPourTest(dossier: DossierVerification): void;
  definirPiecesDeposeesPourTest(pieces: PieceDeposee[]): void;
  definirOffresPourTest(offres: Offre[]): void;
  // publierOffre rend cette issue au prochain appel, une seule fois : un refus du serveur avec
  // son texte, ou l'absence de réponse.
  echouerProchainePublicationPourTest(
    issue: { issue: 'refusee'; refus: RefusServeur } | { issue: 'sans_reponse' },
  ): void;
  definirProfilsCoachPublicsPourTest(profils: Record<string, ProfilCoachPublic>): void;
  definirOffresPubliquesPourTest(offres: Record<string, Offre[]>): void;
  // L3-01/L3-02 : rechercherCoachs prend une FONCTION, pas un tableau fixe — un test d'écran a
  // besoin de résultats différents selon les paramètres reçus (nouveau filtre, second appel
  // « Ouvrir aux visio » de L3-03 avec un format relâché). Par défaut : ensemble vide, total 0.
  definirRechercheCoachsPourTest(
    gestionnaire: (parametres: ParametresRecherche) => ResultatRecherche,
  ): void;

  definirConsentementCommunicationsPourTest(etat: {
    accorde: boolean;
    version: string | null;
  }): void;
  definirHistoriqueConsentementsPourTest(
    historique: { type: string; accorde: boolean; version: string; horodatage: string }[],
  ): void;
  echouerProchainExportPourTest(code: string): void;
  definirDernierExportPourTest(
    export_: {
      demandeLe: string;
      pretLe: string | null;
      urlTelechargement: string | null;
      expireLe: string | null;
      tailleOctets: number | null;
    } | null,
  ): void;

  definirDatesDocumentsPourTest(dates: { cguVersionAcceptee: string; creeLe: string }): void;

  // L3bis
  definirJetonInvitationPourTest(jeton: string): void;
  definirInvitationsPourTest(nouvellesInvitations: Invitation[]): void;
  definirNombreInvitationsEnAttentePourTest(nombre: number): void;
  // I-02 lit un jeton qu'aucun compte connecté ne possède (visiteur anonyme) : la table jeton ->
  // coachId simule coach_par_jeton_invitation() sans dépendre de l'état du coach courant.
  definirCoachParJetonPourTest(table: Record<string, string>): void;

  // L4 : la réponse que rendra la prochaine demande d'intention, ou une fonction qui la calcule
  // (pour une réponse qui n'arrive qu'à un moment choisi par le test : double appui).
  definirReponseIntentionPourTest(
    reponse: ResultatIntention | (() => Promise<ResultatIntention>),
  ): void;
  // Chaque demande reçue, dans l'ordre : un double appui, une clé réutilisée se voient ici.
  lireDemandesIntentionPourTest(): { offreId: string; cleIdempotence: string }[];
  // Une réponse, ou une suite de réponses rendues dans l'ordre (la dernière se répète) : l'attente
  // bornée de 04b (P4.6b) enchaîne plusieurs constats.
  // L4-24b : les abonnements du client et les transitions demandées (machine de 0033, réduite
  // aux trois transitions du client).
  definirAbonnementsPourTest(abonnements: AbonnementClient[]): void;
  lireTransitionsPourTest(): { abonnementId: string; transition: TransitionAbonnement }[];
  refuserProchaineTransitionPourTest(code: string): void;
  lirePausesPourTest(): { abonnementId: string; jours: number }[];
  refuserProchainePausePourTest(code: string, possibleLe?: string): void;
  definirReponseConstatPourTest(reponse: ResultatConstat | ResultatConstat[]): void;
  lireNombreConstatsPourTest(): number;
  // Étape serveur de L4 : le détail d'un abonnement (04c, écran 20), par identifiant ; sans
  // réglage, lireDetailAbonnement lève (abonnement_introuvable).
  definirDetailAbonnementPourTest(table: Record<string, DetailAbonnement>): void;
  // Écran 20 : la page d'un nouveau moyen, et son constat au retour.
  definirReponseNouveauMoyenPourTest(reponse: ResultatNouveauMoyen): void;
  lireDemandesNouveauMoyenPourTest(): string[];
  definirConstatNouveauMoyenPourTest(reponse: ConstatNouveauMoyen): void;
  // Avis (P4.9a) : par coach ; sans réglage, aucun avis et l'état « aucun ».
  definirAvisDuCoachPourTest(table: Record<string, AvisDuCoach>): void;
  definirMonAvisPourTest(table: Record<string, EtatMonAvis>): void;
  definirReponseAvisPourTest(reponse: ResultatAvis): void;
  lireEcrituresAvisPourTest(): {
    operation: 'depot' | 'modification';
    coachId: string;
    saisie: SaisieAvis;
  }[];
  // L5. Sans réglage : compte de versement absent, identité fiscale vide, solde nul, rien
  // d'autre.
  definirIdentificationPourTest(identification: Identification): void;
  definirIdentiteFiscalePourTest(identite: IdentiteFiscale | null): void;
  definirReponseIdentiteFiscalePourTest(reponse: ResultatServeur<object>): void;
  lireIdentitesFiscalesEnregistreesPourTest(): IdentiteFiscale[];
  definirLienIdentificationPourTest(reponse: ResultatServeur<{ url: string }>): void;
  definirSoldePourTest(solde: Solde): void;
  definirVersementsPourTest(versements: Versement[]): void;
  definirReponseVersementPourTest(reponse: ResultatServeur<{ statut: StatutVersement }>): void;
  lireDemandesVersementPourTest(): number;
  definirRevenusPourTest(revenus: RevenusMois[]): void;
  definirFacturesPourTest(factures: FactureResume[], details: Record<string, FactureDetail>): void;
  definirFacturesCommissionPourTest(factures: FactureCommission[]): void;
  definirRappelCommissionPourTest(rappel: RappelCommission | null): void;
  // L6, studio. Le faux applique les règles du serveur (0081, 0083, 0085) en mémoire.
  definirCoachVerifiePourTest(verifie: boolean): void;
  definirAbonnesAffectablesPourTest(abonnes: AbonneAffectable[]): void;
  // Le prochain appel d'écriture du studio est refusé avec ce code.
  definirRefusStudioPourTest(code: string | null): void;
  lireProgrammesPourTest(): ProgrammeResume[];
  // L6, séance du jour : une séance programmée du client, ses exercices, et ce qu'il a saisi.
  definirSeanceClientPourTest(
    seance: SeanceProgrammeeDetail & { nombreExercices: number; duJour: boolean },
    exercices: ExerciceDeSeance[],
  ): void;
  // L7, clients du coach : ce que le serveur rendrait (badges, compteurs et métriques sont
  // calculés par lui, 0093). Les notes, elles, suivent les règles d'écriture du serveur.
  definirMesClientsPourTest(valeur: MesClients): void;
  definirAnciensClientsPourTest(valeur: AncienClient[]): void;
  definirFicheClientPourTest(fiche: FicheClient): void;
  definirPilotagePourTest(valeur: Pilotage): void;
  lireSeanceClientPourTest(id: string):
    | (SeanceProgrammeeDetail & {
        ressentiEffort: number | null;
        commentaire: string | null;
        series: SerieSaisie[];
      })
    | null;
};

// docs/api.md §3 : un compte neuf a toujours profilActif = 'client' (colonne NOT NULL, défaut
// 'client', posée à la création — voir 0001_creer_identite.sql), même sans aucun profil. C'est
// donc l'état par défaut le plus honnête de ce faux, pas 'coach' ni une valeur inventée.
//
// Exportée (pas seulement interne à creerFauxPortDonnees) : plusieurs fichiers de test
// construisaient EtatProfils à la main, littéral par littéral — l'ajout d'identiteActive et
// attentesCoach (L1-06) en a cassé huit d'un coup. `surcharges` permet à chacun de ne préciser
// que les champs qui l'intéressent, comme port.definirEtatProfilsPourTest le fait déjà en
// interne : le prochain champ ajouté à EtatProfils ne cassera plus qu'ici.
export function etatProfilsParDefaut(surcharges: Partial<EtatProfils> = {}): EtatProfils {
  return {
    profilActif: 'client',
    clientExiste: false,
    clientOnboardingEtape: null,
    coachExiste: false,
    identiteActive: { prenom: '', nom: null },
    attentesCoach: 0,
    ...surcharges,
  };
}

// Défaut le plus honnête : un compte neuf est en espace client (voir etatProfilsParDefaut),
// prénom vide, sans nom. La date de naissance a forcément une valeur (colonne NOT NULL de
// comptes) — une majeure quelconque, jamais analysée ici.
function informationsCompteParDefaut(): InformationsCompte {
  return {
    profil: 'client',
    prenom: '',
    nom: null,
    communeInsee: null,
    dateNaissance: '2000-01-01',
  };
}

function profilOnboardingVide(): ProfilOnboarding {
  return {
    prenom: '',
    nom: null,
    objectifs: [],
    rythme: null,
    poidsDepartGrammes: null,
    poidsCibleGrammes: null,
  };
}

// Faux en mémoire : créé par test, jeté par test (CLAUDE.md — règle de L0 : aucune dépendance à
// une restauration globale entre tests).
export function creerFauxPortDonnees(): FauxPortDonnees {
  let etat: EtatProfils = etatProfilsParDefaut();
  const coachsSuivis = new Set<string>();
  let profilOnboarding: ProfilOnboarding = profilOnboardingVide();
  let informations: InformationsCompte = informationsCompteParDefaut();
  // État courant du consentement santé (journal réduit à son dernier état, suffisant ici).
  // version null = aucun consentement jamais enregistré.
  let consentementSante: { accorde: boolean; version: string | null } = {
    accorde: false,
    version: null,
  };
  let prochaineEcritureEchoue: string | null = null;
  // Par défaut, aucun serveur : jamais une page de paiement inventée (prix, date, URL).
  let reponseIntention: ResultatIntention | (() => Promise<ResultatIntention>) = {
    issue: 'sans_reponse',
  };
  let demandesIntention: { offreId: string; cleIdempotence: string }[] = [];
  let abonnements: AbonnementClient[] = [];
  let transitions: { abonnementId: string; transition: TransitionAbonnement }[] = [];
  let refusTransition: string | null = null;
  let pauses: { abonnementId: string; jours: number }[] = [];
  let refusPause: { code: string; possibleLe: string | null } | null = null;
  let reponsesConstat: ResultatConstat[] = [{ issue: 'sans_reponse' }];
  let detailsAbonnement: Record<string, DetailAbonnement> = {};
  let reponseNouveauMoyen: ResultatNouveauMoyen = { issue: 'sans_reponse' };
  let demandesNouveauMoyen: string[] = [];
  let constatNouveauMoyen: ConstatNouveauMoyen = { issue: 'constat', etat: 'aucune' };
  let nombreConstats = 0;
  let dossierVerification: DossierVerification = { statut: 'absente', deposeLe: null, motif: null };
  let piecesDeposees: PieceDeposee[] = [];
  // Types déposés depuis la dernière décision : miroir du « nouveau dossier » de 0053, où un
  // dossier refusé ne repart en examen qu'avec les trois pièces redéposées APRÈS la décision.
  // Remis à zéro quand un test pose un dossier (définir un dossier = une décision prise).
  let typesDepuisDecision = new Set<TypePiece>();
  let offres: Offre[] = [];
  let prochainePublicationEchoue:
    { issue: 'refusee'; refus: RefusServeur } | { issue: 'sans_reponse' } | null = null;
  let profilsCoachPublics: Record<string, ProfilCoachPublic> = {};
  let offresPubliques: Record<string, Offre[]> = {};
  let gestionnaireRecherche: (parametres: ParametresRecherche) => ResultatRecherche = () => ({
    resultats: [],
    totalResultats: 0,
  });
  let consentementCommunications: { accorde: boolean; version: string | null } = {
    accorde: false,
    version: null,
  };
  let historiqueConsentements: {
    type: string;
    accorde: boolean;
    version: string;
    horodatage: string;
  }[] = [];
  let prochainExportEchoue: string | null = null;
  let dernierExport: {
    demandeLe: string;
    pretLe: string | null;
    urlTelechargement: string | null;
    expireLe: string | null;
    tailleOctets: number | null;
  } | null = null;
  let prochainIdOffre = 1;
  // Valeurs par défaut arbitraires (le vrai « acceptée le » vient de comptes.cree_le, aucune
  // signification particulière ici) : un test qui exerce le bandeau « Une version a changé »
  // passe explicitement une version différente via definirDatesDocumentsPourTest.
  let datesDocuments: { cguVersionAcceptee: string; creeLe: string } = {
    cguVersionAcceptee: '2026-09-04',
    creeLe: '2026-01-01T00:00:00.000Z',
  };
  // L3bis : 22 caractères, même forme que le vrai jeton (0026) — un test qui vérifierait la
  // longueur affichée par erreur sur le faux port trouverait la même chose que contre la vraie
  // base.
  let jetonInvitation = 'demo-jeton-fictif-22ab';
  let invitations: Invitation[] = [];
  let nombreInvitationsEnAttente = 0;
  let coachsParJetonPourTest: Record<string, string> = {};
  let avisDuCoach: Record<string, AvisDuCoach> = {};
  let monAvis: Record<string, EtatMonAvis> = {};
  let reponseAvis: ResultatAvis = { issue: 'sans_reponse' };
  let identification: Identification = {
    compteVersement: 'absent',
    identiteFiscaleComplete: false,
    peutPublier: false,
  };
  let identiteFiscale: IdentiteFiscale | null = null;
  let reponseIdentiteFiscale: ResultatServeur<object> = { issue: 'ok' };
  let identitesEnregistrees: IdentiteFiscale[] = [];
  let reponseLien: ResultatServeur<{ url: string }> = { issue: 'sans_reponse' };
  let solde: Solde = {
    soldeCentimes: 0,
    versementEnCours: false,
    prochainVersementLe: '2026-12-05',
    compteOperationnel: false,
  };
  let versements: Versement[] = [];
  let reponseVersement: ResultatServeur<{ statut: StatutVersement }> = { issue: 'sans_reponse' };
  let demandesVersement = 0;
  let revenus: RevenusMois[] = [];
  let mesClients: MesClients = {
    clients: [],
    compteurs: { tous: 0, aRelancer: 0, nouveaux: 0, anciens: 0 },
  };
  let anciensClients: AncienClient[] = [];
  const fichesClients = new Map<string, FicheClient>();
  let pilotage: Pilotage = {
    aucunClient: true,
    clientsAvecAcces: 0,
    assiduiteMoyenne: null,
    aTraiterTotal: 0,
    aTraiter: [],
  };
  let factures: FactureResume[] = [];
  let detailsFactures: Record<string, FactureDetail> = {};
  let facturesCommission: FactureCommission[] = [];
  let rappelCommission: RappelCommission | null = null;
  // L6, studio, en mémoire.
  type FauxProgramme = {
    id: string;
    titre: string;
    dureeSemaines: number;
    statut: StatutProgramme;
  };
  type FauxSeance = {
    id: string;
    programmeId: string;
    titre: string;
    dureeMinutes: number;
    jourRelatif: number;
  };
  type FauxExercice = ExerciceProgramme & { seanceId: string };
  const programmes: FauxProgramme[] = [];
  const seancesStudio: FauxSeance[] = [];
  const exercicesStudio: FauxExercice[] = [];
  const mediasStudio: MediaBibliotheque[] = [];
  // programmeId → profils clients affectés (« abonnés en cours »).
  const affectations = new Map<string, Set<string>>();
  let abonnesAffectables: AbonneAffectable[] = [];
  let coachVerifie = true;
  let refusStudio: string | null = null;
  type FauxSeanceClient = SeanceProgrammeeDetail & {
    nombreExercices: number;
    duJour: boolean;
    exercices: ExerciceDeSeance[];
    series: SerieSaisie[];
    ressentiEffort: number | null;
    commentaire: string | null;
  };
  const seancesClient: FauxSeanceClient[] = [];
  // L7 : mêmes règles que 0089 — valeur en grammes / millimètres, date posée « par le
  // serveur », clés gardées après effacement.
  type FauxMesure = { id: string; type: TypeMesure; valeur: number; le: string; cle: string };
  let mesures: FauxMesure[] = [];
  const clesMesures = new Set<string>();
  const facteurMesure: Record<TypeMesure, number> = { poids: 1000, tour_de_taille: 10 };
  const serieDe = (type: TypeMesure): SerieMesures | null => {
    // Tri stable : par date, puis par ordre d'enregistrement (l'ordre du tableau).
    const liste = mesures.filter((m) => m.type === type).sort((a, b) => a.le.localeCompare(b.le));
    const premiere = liste[0];
    const derniere = liste[liste.length - 1];
    if (!premiere || !derniere) return null;
    const point = (m: FauxMesure) => ({ valeur: m.valeur / facteurMesure[type], le: m.le });
    return {
      premiere: point(premiere),
      derniere: point(derniere),
      ecart: (derniere.valeur - premiere.valeur) / facteurMesure[type],
      nombre: liste.length,
    };
  };
  const seanceClient = (id: string) => seancesClient.find((x) => x.id === id);
  let compteurStudio = 0;
  const nouvelId = (prefixe: string) => `${prefixe}-${++compteurStudio}`;
  const ok = <T>(valeur: T): ResultatStudio<T> => ({ issue: 'ok', valeur });
  const refus = (code: string): { issue: 'refusee'; code: string } => ({ issue: 'refusee', code });
  // Le refus forcé d'un test passe avant toute règle, une seule fois.
  const refusForce = (): { issue: 'refusee'; code: string } | null => {
    if (refusStudio === null) return null;
    const code = refusStudio;
    refusStudio = null;
    return refus(code);
  };
  const brouillon = (id: string): FauxProgramme | { issue: 'refusee'; code: string } => {
    const programme = programmes.find((x) => x.id === id);
    if (!programme) return refus('programme_introuvable');
    if (programme.statut !== 'brouillon') return refus('programme_non_modifiable');
    return programme;
  };
  const seanceEnBrouillon = (id: string): FauxSeance | { issue: 'refusee'; code: string } => {
    const seance = seancesStudio.find((x) => x.id === id);
    if (!seance) return refus('seance_introuvable');
    const programme = brouillon(seance.programmeId);
    return 'issue' in programme ? programme : seance;
  };
  const resume = (x: FauxProgramme): ProgrammeResume => ({
    ...x,
    nombreSeances: seancesStudio.filter((y) => y.programmeId === x.id).length,
    abonnesEnCours: affectations.get(x.id)?.size ?? 0,
  });
  let ecrituresAvis: {
    operation: 'depot' | 'modification';
    coachId: string;
    saisie: SaisieAvis;
  }[] = [];

  // true : applique nouvelEtat/nouveauProfil et rend { succes: true } ; false : consomme
  // l'échec programmé et ne change rien (docs/ecrans/L1-05, États : "l'étape n'avance pas et
  // rien n'est perdu" — la valeur PRÉCÉDENTE reste lisible).
  function ecrire(nouvelEtat: EtatProfils, nouveauProfil: ProfilOnboarding): ResultatEcriture {
    if (prochaineEcritureEchoue !== null) {
      const erreur = prochaineEcritureEchoue;
      prochaineEcritureEchoue = null;
      return { succes: false, erreur };
    }
    etat = nouvelEtat;
    profilOnboarding = nouveauProfil;
    return { succes: true };
  }

  return {
    async lireEtatProfils() {
      return etat;
    },

    async lireProfilOnboarding() {
      return profilOnboarding;
    },

    definirEtatProfilsPourTest(nouvelEtat) {
      etat = nouvelEtat;
    },

    definirInformationsPourTest(nouvellesInformations) {
      informations = nouvellesInformations;
    },

    echouerProchaineEcriturePourTest(erreur = 'Une erreur de test, jamais affichée telle quelle.') {
      prochaineEcritureEchoue = erreur;
    },

    // Miroir de creer_profil_client (0051) : crée ou met à jour, puis active l'espace client.
    async creerProfilClient(prenom, nom) {
      const nomOuAbsent = nom === '' ? null : nom;
      return ecrire(
        {
          ...etat,
          clientExiste: true,
          clientOnboardingEtape: 2,
          profilActif: 'client',
          identiteActive: { prenom, nom: nomOuAbsent },
        },
        { ...profilOnboarding, prenom, nom: nomOuAbsent },
      );
    },

    async enregistrerObjectifsEtRythme(objectifs, rythme) {
      return ecrire(
        { ...etat, clientOnboardingEtape: 3 },
        { ...profilOnboarding, objectifs, rythme },
      );
    },

    async enregistrerPointDeDepart({
      consentementAccorde,
      versionConsentement,
      poidsDepartGrammes,
      poidsCibleGrammes,
    }) {
      const resultat = ecrire(
        { ...etat, clientOnboardingEtape: 4 },
        {
          ...profilOnboarding,
          poidsDepartGrammes: consentementAccorde
            ? (poidsDepartGrammes ?? profilOnboarding.poidsDepartGrammes)
            : profilOnboarding.poidsDepartGrammes,
          poidsCibleGrammes: consentementAccorde
            ? (poidsCibleGrammes ?? profilOnboarding.poidsCibleGrammes)
            : profilOnboarding.poidsCibleGrammes,
        },
      );
      if (resultat.succes && consentementAccorde) {
        consentementSante = { accorde: true, version: versionConsentement };
      }
      return resultat;
    },

    async terminerOnboarding() {
      return ecrire({ ...etat, clientOnboardingEtape: 5 }, profilOnboarding);
    },

    // Reproduit la règle du vrai basculer_profil (0002) : un profil inexistant est refusé.
    // Jusqu'au 2 novembre 2026, ce faux l'acceptait, en supposant que la feuille ne proposait la
    // bascule que vers un profil existant. C'était faux pour « Espace client », toujours affiché :
    // un compte seulement coach y obtenait une panne, et aucun test ne pouvait le voir.
    async basculerProfil(profil) {
      const existe = profil === 'client' ? etat.clientExiste : etat.coachExiste;
      if (!existe) return { succes: false, erreur: 'Ce profil n’existe pas pour ce compte.' };
      return ecrire({ ...etat, profilActif: profil }, profilOnboarding);
    },

    async creerProfilCoach({ prenom, nom }) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      // Atomique côté vrai serveur (0005) : ici, en mémoire, une seule affectation.
      etat = {
        ...etat,
        coachExiste: true,
        profilActif: 'coach',
        identiteActive: { prenom, nom },
      };
      return { succes: true };
    },

    async lireInformations() {
      return informations;
    },

    async enregistrerInformations(modifs: ModificationsInformations) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }

      // Garde dateNaissance et, côté coach, discipline : ni l'une ni l'autre n'est réécrite ici
      // (colonnes protégées / P1.14). L'identité active (lue par lireEtatProfils, affichée par
      // l'écran compte) suit la même écriture, comme en base.
      informations =
        modifs.profil === 'coach' && informations.profil === 'coach'
          ? {
              ...informations,
              prenom: modifs.prenom,
              nom: modifs.nom,
              titreCourt: modifs.titreCourt,
              bio: modifs.bio,
              communeBaseInsee: modifs.communeBaseInsee,
              formats: modifs.formats,
              parcoursTexte: modifs.parcoursTexte,
              langues: modifs.langues,
            }
          : modifs.profil === 'client' && informations.profil === 'client'
            ? {
                ...informations,
                prenom: modifs.prenom,
                nom: modifs.nom,
                communeInsee: modifs.communeInsee,
              }
            : informations;
      etat = { ...etat, identiteActive: { prenom: modifs.prenom, nom: modifs.nom } };
      return { succes: true };
    },

    definirConsentementSantePourTest(nouvelEtat) {
      consentementSante = nouvelEtat;
    },

    async lireConsentementSante() {
      return consentementSante;
    },

    async enregistrerConsentementSante(accorde, version) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      consentementSante = { accorde, version };
      return { succes: true };
    },

    async effacerMesuresCorporelles() {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      profilOnboarding = {
        ...profilOnboarding,
        poidsDepartGrammes: null,
        poidsCibleGrammes: null,
      };
      mesures = [];
      return { succes: true };
    },

    definirDossierVerificationPourTest(dossier) {
      dossierVerification = dossier;
      typesDepuisDecision = new Set();
    },
    async lireDossierVerification() {
      return dossierVerification;
    },

    definirPiecesDeposeesPourTest(pieces) {
      piecesDeposees = pieces;
    },
    async lirePiecesDeposees() {
      return piecesDeposees;
    },

    async deposerPieceVerification(type: TypePiece, fichier) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      const maintenant = new Date().toISOString();
      // Comme le serveur (0012 : « l'ancien dépôt reste une preuve ») : un remplacement AJOUTE
      // une ligne, il n'écrase pas l'ancienne. Corrigé à A2 (11 novembre 2026) : ce faux écrasait,
      // et cachait ainsi un écran qui affichait le plus ANCIEN dépôt de chaque type.
      piecesDeposees = [
        ...piecesDeposees,
        { type, deposeLe: maintenant, nomFichier: fichier.nom, tailleOctets: null },
      ];
      typesDepuisDecision.add(type);
      // Miroir de soumettre_dossier_si_complet (0053).
      const { statut } = dossierVerification;
      const typesDeposes = new Set(piecesDeposees.map((p) => p.type));
      if (statut === 'absente' && typesDeposes.size === 3) {
        dossierVerification = { ...dossierVerification, statut: 'en_examen', deposeLe: maintenant };
      } else if (statut === 'complement_demande') {
        dossierVerification = { ...dossierVerification, statut: 'en_examen' };
      } else if (
        (statut === 'refusee' || statut === 'revoquee') &&
        typesDepuisDecision.size === 3
      ) {
        dossierVerification = { ...dossierVerification, statut: 'en_examen', deposeLe: maintenant };
      }
      return { succes: true };
    },

    definirOffresPourTest(nouvellesOffres) {
      offres = nouvellesOffres;
    },
    async lireMesOffres() {
      return offres;
    },

    async creerOffreBrouillon(modifs: ModificationsOffre) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      const id = `offre-test-${prochainIdOffre++}`;
      offres = [
        ...offres,
        {
          id,
          titre: modifs.titre,
          description: modifs.description,
          prixCentimes: modifs.prixCentimes,
          benefices: modifs.benefices,
          engagementHumain: modifs.engagementHumain,
          estMiseEnAvant: modifs.estMiseEnAvant,
          publieeLe: null,
          retireeLe: null,
        },
      ];
      return { succes: true, id };
    },

    async modifierOffre(id: string, modifs: ModificationsOffre) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      offres = offres.map((o) =>
        o.id === id
          ? {
              ...o,
              titre: modifs.titre,
              description: modifs.description,
              prixCentimes: modifs.prixCentimes,
              benefices: modifs.benefices,
              engagementHumain: modifs.engagementHumain,
              estMiseEnAvant: modifs.estMiseEnAvant,
            }
          : o,
      );
      return { succes: true };
    },

    echouerProchainePublicationPourTest(issue) {
      prochainePublicationEchoue = issue;
    },
    async publierOffre(id: string): Promise<ResultatPublicationOffre> {
      if (prochainePublicationEchoue !== null) {
        const issue = prochainePublicationEchoue;
        prochainePublicationEchoue = null;
        return issue;
      }
      offres = offres.map((o) =>
        o.id === id ? { ...o, publieeLe: new Date().toISOString(), retireeLe: null } : o,
      );
      return { issue: 'publiee' };
    },

    async retirerOffre(id: string) {
      offres = offres.map((o) => (o.id === id ? { ...o, retireeLe: new Date().toISOString() } : o));
      return { succes: true };
    },

    definirProfilsCoachPublicsPourTest(profils) {
      profilsCoachPublics = profils;
    },
    async lireMesCoachsSuivis() {
      if (etat.profilActif !== 'client' || !etat.clientExiste)
        throw new Error('profil_client_requis');
      return [...coachsSuivis].reverse().flatMap((id) => {
        const coach = profilsCoachPublics[id];
        if (!coach?.verifiee) return [];
        const { prenom, nom, discipline } = coach;
        return [{ id, prenom, nom, discipline }];
      });
    },

    async definirSuiviCoach(coachId, suivre) {
      if (etat.profilActif !== 'client' || !etat.clientExiste)
        throw new Error('profil_client_requis');
      if (!suivre) {
        coachsSuivis.delete(coachId);
        return;
      }
      if (!profilsCoachPublics[coachId]?.verifiee) throw new Error('coach_indisponible');
      coachsSuivis.add(coachId);
    },

    async lireProfilCoachPublic(coachId: string) {
      return profilsCoachPublics[coachId] ?? null;
    },

    async lireDisciplines() {
      return DISCIPLINES_FIGEES;
    },

    async lireCommunesReference() {
      return COMMUNES_FIGEES;
    },

    async lireLangues() {
      return LANGUES_FIGEES;
    },

    definirRechercheCoachsPourTest(gestionnaire) {
      gestionnaireRecherche = gestionnaire;
    },
    async rechercherCoachs(parametres) {
      return gestionnaireRecherche(parametres);
    },

    definirOffresPubliquesPourTest(nouvellesOffresPubliques) {
      offresPubliques = nouvellesOffresPubliques;
    },
    async lireOffresPublieesDeCoach(coachId: string) {
      return offresPubliques[coachId] ?? [];
    },

    async demanderSuppressionCompte() {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      return { succes: true };
    },

    definirConsentementCommunicationsPourTest(nouvelEtat) {
      consentementCommunications = nouvelEtat;
    },
    async lireConsentementCommunications() {
      return consentementCommunications;
    },
    async enregistrerConsentementCommunications(accorde, version) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      consentementCommunications = { accorde, version };
      historiqueConsentements = [
        {
          type: 'communicationsCommerciales',
          accorde,
          version,
          horodatage: new Date().toISOString(),
        },
        ...historiqueConsentements,
      ];
      return { succes: true };
    },

    definirHistoriqueConsentementsPourTest(historique) {
      historiqueConsentements = historique;
    },
    async lireHistoriqueConsentements() {
      return historiqueConsentements;
    },

    echouerProchainExportPourTest(code) {
      prochainExportEchoue = code;
    },
    async demanderExportDonnees() {
      if (prochainExportEchoue !== null) {
        const code = prochainExportEchoue;
        prochainExportEchoue = null;
        return { succes: false, code };
      }
      dernierExport = {
        demandeLe: new Date().toISOString(),
        pretLe: null,
        urlTelechargement: null,
        expireLe: null,
        tailleOctets: null,
      };
      return { succes: true };
    },

    definirDernierExportPourTest(export_) {
      dernierExport = export_;
    },
    async lireDernierExport() {
      return dernierExport;
    },

    definirDatesDocumentsPourTest(dates) {
      datesDocuments = dates;
    },
    async lireDatesDocuments() {
      return datesDocuments;
    },

    async lireMonJetonInvitation() {
      return jetonInvitation;
    },
    async regenererJetonInvitation() {
      // Fictif mais reconnaissable : suffit à prouver qu'un écran de test a bien reçu une
      // NOUVELLE valeur, différente de l'ancienne — jamais comparé à la vraie forme du jeton.
      jetonInvitation = `regenere-${Date.now().toString(36).slice(0, 13)}`;
      return jetonInvitation;
    },
    definirJetonInvitationPourTest(jeton) {
      jetonInvitation = jeton;
    },

    async lireMesInvitations() {
      return invitations;
    },
    definirInvitationsPourTest(nouvellesInvitations) {
      invitations = nouvellesInvitations;
    },

    async lireNombreInvitationsEnAttente() {
      return nombreInvitationsEnAttente;
    },
    definirNombreInvitationsEnAttentePourTest(nombre) {
      nombreInvitationsEnAttente = nombre;
    },
    async ajouterInvitationEnAttente() {
      nombreInvitationsEnAttente += 1;
      return { succes: true };
    },

    async lireCoachParJetonInvitation(jeton) {
      return coachsParJetonPourTest[jeton] ?? null;
    },
    definirCoachParJetonPourTest(table) {
      coachsParJetonPourTest = table;
    },

    async demanderIntention(offreId, cleIdempotence) {
      demandesIntention = [...demandesIntention, { offreId, cleIdempotence }];
      return typeof reponseIntention === 'function' ? reponseIntention() : reponseIntention;
    },
    definirReponseIntentionPourTest(reponse) {
      reponseIntention = reponse;
    },
    lireDemandesIntentionPourTest() {
      return demandesIntention;
    },
    definirAbonnementsPourTest(valeur) {
      abonnements = valeur;
    },
    async lireMesAbonnements() {
      return abonnements;
    },
    lireTransitionsPourTest() {
      return transitions;
    },
    refuserProchaineTransitionPourTest(code) {
      refusTransition = code;
    },
    lirePausesPourTest() {
      return pauses;
    },
    refuserProchainePausePourTest(code, possibleLe) {
      refusPause = { code, possibleLe: possibleLe ?? null };
    },
    async demanderPause(abonnementId, jours) {
      pauses = [...pauses, { abonnementId, jours }];
      if (refusPause) {
        const refus = refusPause;
        refusPause = null;
        return { succes: false, ...refus };
      }
      // Miroir de 0059 : actif seulement, 1 à 60 jours, fin = aujourd'hui (Paris) + jours.
      const a = abonnements.find((x) => x.id === abonnementId);
      if (!a || a.statut !== 'actif') {
        return { succes: false, code: 'transition_interdite', possibleLe: null };
      }
      if (jours < 1 || jours > 60) {
        return { succes: false, code: 'duree_pause_invalide', possibleLe: null };
      }
      const aujourdhui = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(
        new Date(),
      );
      const fin = new Date(`${aujourdhui}T12:00:00Z`);
      fin.setUTCDate(fin.getUTCDate() + jours);
      abonnements = abonnements.map((x) =>
        x.id === abonnementId
          ? { ...x, statut: 'en_pause', pauseJusquLe: fin.toISOString().slice(0, 10) }
          : x,
      );
      return { succes: true };
    },
    async transitionAbonnement(abonnementId, transition) {
      transitions = [...transitions, { abonnementId, transition }];
      if (refusTransition) {
        const code = refusTransition;
        refusTransition = null;
        return { succes: false, code };
      }
      // Miroir de 0033 (demander_resiliation, annuler_resiliation, reprendre_abonnement).
      const suivant: Partial<
        Record<TransitionAbonnement, Partial<Record<StatutAbonnement, StatutAbonnement>>>
      > = {
        resilier: {
          actif: 'resiliation_programmee',
          en_pause: 'resilie',
          impaye: 'resilie',
          suspendu: 'resilie',
        },
        annuler_resiliation: { resiliation_programmee: 'actif' },
        reprendre: { en_pause: 'actif' },
      };
      const a = abonnements.find((x) => x.id === abonnementId);
      const statut = a ? suivant[transition]?.[a.statut] : undefined;
      if (!a || !statut) return { succes: false, code: 'transition_interdite' };
      abonnements = abonnements.map((x) =>
        x.id === abonnementId
          ? {
              ...x,
              statut,
              finAccesLe:
                transition === 'resilier'
                  ? x.prochainPrelevementLe
                  : statut === 'actif'
                    ? null
                    : x.finAccesLe,
              pauseJusquLe: transition === 'reprendre' ? null : x.pauseJusquLe,
            }
          : x,
      );
      return { succes: true };
    },
    async constaterIntention() {
      const reponse = reponsesConstat[Math.min(nombreConstats, reponsesConstat.length - 1)];
      nombreConstats += 1;
      return reponse;
    },
    definirReponseConstatPourTest(reponse) {
      reponsesConstat = Array.isArray(reponse) ? reponse : [reponse];
      nombreConstats = 0;
    },
    lireNombreConstatsPourTest() {
      return nombreConstats;
    },
    async lireDetailAbonnement(abonnementId) {
      const detail = detailsAbonnement[abonnementId];
      if (!detail) throw new Error('abonnement_introuvable');
      return detail;
    },
    definirDetailAbonnementPourTest(table) {
      detailsAbonnement = table;
    },
    async demanderNouveauMoyen(abonnementId) {
      demandesNouveauMoyen = [...demandesNouveauMoyen, abonnementId];
      return reponseNouveauMoyen;
    },
    definirReponseNouveauMoyenPourTest(reponse) {
      reponseNouveauMoyen = reponse;
    },
    lireDemandesNouveauMoyenPourTest() {
      return demandesNouveauMoyen;
    },
    async constaterNouveauMoyen() {
      return constatNouveauMoyen;
    },
    definirConstatNouveauMoyenPourTest(reponse) {
      constatNouveauMoyen = reponse;
    },

    async lireEtiquettesAvis() {
      return ETIQUETTES_AVIS_FIGEES;
    },
    async lireAvisDuCoach(coachId) {
      return avisDuCoach[coachId] ?? AUCUN_AVIS;
    },
    async lireMonAvis(coachId) {
      return monAvis[coachId] ?? { etat: 'aucun' };
    },
    async deposerAvis(coachId, saisie) {
      ecrituresAvis = [...ecrituresAvis, { operation: 'depot', coachId, saisie }];
      return reponseAvis;
    },
    async modifierAvis(coachId, saisie) {
      ecrituresAvis = [...ecrituresAvis, { operation: 'modification', coachId, saisie }];
      return reponseAvis;
    },
    definirAvisDuCoachPourTest(table) {
      avisDuCoach = table;
    },
    definirMonAvisPourTest(table) {
      monAvis = table;
    },
    definirReponseAvisPourTest(reponse) {
      reponseAvis = reponse;
    },
    lireEcrituresAvisPourTest() {
      return ecrituresAvis;
    },

    async lireIdentification() {
      return identification;
    },
    definirIdentificationPourTest(valeur) {
      identification = valeur;
    },
    async demanderLienIdentification() {
      return reponseLien;
    },
    definirLienIdentificationPourTest(reponse) {
      reponseLien = reponse;
    },
    async lireMonIdentiteFiscale() {
      return identiteFiscale;
    },
    definirIdentiteFiscalePourTest(valeur) {
      identiteFiscale = valeur;
    },
    async enregistrerIdentiteFiscale(saisie) {
      identitesEnregistrees = [...identitesEnregistrees, saisie];
      return reponseIdentiteFiscale;
    },
    definirReponseIdentiteFiscalePourTest(reponse) {
      reponseIdentiteFiscale = reponse;
    },
    lireIdentitesFiscalesEnregistreesPourTest() {
      return identitesEnregistrees;
    },
    async lireSolde() {
      return solde;
    },
    definirSoldePourTest(valeur) {
      solde = valeur;
    },
    async lireVersements() {
      return versements;
    },
    definirVersementsPourTest(valeur) {
      versements = valeur;
    },
    async demanderVersement() {
      demandesVersement += 1;
      return reponseVersement;
    },
    definirReponseVersementPourTest(reponse) {
      reponseVersement = reponse;
    },
    lireDemandesVersementPourTest() {
      return demandesVersement;
    },
    async lireMesClients() {
      return mesClients;
    },
    definirMesClientsPourTest(valeur) {
      mesClients = valeur;
    },
    async lireMesAnciensClients() {
      return anciensClients;
    },
    definirAnciensClientsPourTest(valeur) {
      anciensClients = valeur;
    },
    async lireFicheClient(profilClientId) {
      const fiche = fichesClients.get(profilClientId);
      if (!fiche) throw new Error('client_introuvable');
      return fiche;
    },
    definirFicheClientPourTest(fiche) {
      fichesClients.set(fiche.profilClientId, fiche);
    },
    // Mêmes règles que enregistrer_notes_client (0093).
    async enregistrerNotesClient(profilClientId, texte) {
      const force = refusForce();
      if (force) return force;
      const fiche = fichesClients.get(profilClientId);
      if (!fiche) return refus('client_introuvable');
      if (fiche.mode === 'ancien') return refus('client_ancien');
      if (texte.length > 2000) return refus('notes_invalides');
      fiche.notes = texte.trim() === '' ? null : texte;
      return ok(null);
    },
    async lirePilotage() {
      return pilotage;
    },
    definirPilotagePourTest(valeur) {
      pilotage = valeur;
    },
    async lireRevenus() {
      return revenus;
    },
    definirRevenusPourTest(valeur) {
      revenus = valeur;
    },
    async lireFacturesCommission() {
      return facturesCommission;
    },
    definirFacturesCommissionPourTest(valeur) {
      facturesCommission = valeur;
    },
    async lireRappelCommission() {
      return rappelCommission;
    },
    definirRappelCommissionPourTest(valeur) {
      rappelCommission = valeur;
    },

    // L6, studio.
    definirCoachVerifiePourTest(valeur) {
      coachVerifie = valeur;
    },
    definirAbonnesAffectablesPourTest(valeur) {
      abonnesAffectables = valeur;
    },
    definirRefusStudioPourTest(code) {
      refusStudio = code;
    },
    definirSeanceClientPourTest(seance, exercices) {
      seancesClient.push({
        ...seance,
        exercices,
        series: [],
        ressentiEffort: null,
        commentaire: null,
      });
    },
    lireSeanceClientPourTest(id) {
      const x = seanceClient(id);
      if (!x) return null;
      const { exercices: _e, nombreExercices: _n, duJour: _d, ...reste } = x;
      return reste;
    },
    async lireMonPlanningSeances() {
      if (etat.profilActif !== 'client' || !etat.clientExiste)
        throw new Error('profil_client_requis');
      const jour = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(
        new Date(),
      );
      const decaler = (date: string, jours: number) => {
        const resultat = new Date(date + 'T00:00:00Z');
        resultat.setUTCDate(resultat.getUTCDate() + jours);
        return resultat.toISOString().slice(0, 10);
      };
      const debut = decaler(jour, -7);
      const fin = decaler(jour, 14);
      return seancesClient
        .filter(
          ({ datePrevue, statut }) =>
            (datePrevue > jour && datePrevue <= fin && statut === 'a_faire') ||
            (datePrevue >= debut &&
              datePrevue < jour &&
              (statut === 'manquee' || statut === 'partielle')),
        )
        .sort((a, b) => a.datePrevue.localeCompare(b.datePrevue) || a.titre.localeCompare(b.titre))
        .map(({ id, titre, dureeMinutes, datePrevue, coachPrenom, coachNom }) => ({
          id,
          titre,
          dureeMinutes,
          datePrevue,
          coachPrenom,
          coachNom,
          aRattraperAvant: datePrevue < jour ? decaler(datePrevue, 7) : null,
        }));
    },

    async lireSeancesDuJour() {
      return seancesClient
        .filter((x) => x.duJour)
        .map((x) => ({
          id: x.id,
          titre: x.titre,
          dureeMinutes: x.dureeMinutes,
          nombreExercices: x.nombreExercices,
          coachPrenom: x.coachPrenom,
          coachNom: x.coachNom,
          statut: x.statut,
        }));
    },
    async lireSeanceProgrammee(id) {
      const x = seanceClient(id);
      if (!x) throw new Error('seance_introuvable');
      const {
        exercices: _e,
        nombreExercices: _n,
        duJour: _d,
        series: _s,
        ressentiEffort: _r,
        commentaire: _c,
        ...detail
      } = x;
      return detail;
    },
    async lireExercicesDeMaSeance(id) {
      const x = seanceClient(id);
      if (!x) throw new Error('seance_introuvable');
      return x.exercices;
    },
    async lireSeriesDeMaSeance(id) {
      return seanceClient(id)?.series ?? [];
    },
    async demarrerSeance(id) {
      const force = refusForce();
      if (force) return force;
      const x = seanceClient(id);
      if (!x) return refus('seance_introuvable');
      if (x.statut === 'a_faire') {
        Object.assign(x, { statut: 'en_cours', demarreeLe: new Date().toISOString() });
      } else if (x.statut === 'manquee' || x.statut === 'partielle') {
        Object.assign(x, {
          statut: 'en_cours',
          demarreeLe: new Date().toISOString(),
          rattrapee: true,
        });
      } else return refus('transition_interdite');
      return ok(null);
    },
    async enregistrerSerie(id, serie) {
      const force = refusForce();
      if (force) return force;
      const x = seanceClient(id);
      if (!x) return refus('seance_introuvable');
      if (x.statut !== 'en_cours') return refus('transition_interdite');
      x.series = [
        ...x.series.filter(
          (y) => !(y.exerciceId === serie.exerciceId && y.numero === serie.numero),
        ),
        serie,
      ];
      return ok(null);
    },
    async terminerSeance(id, ressentiEffort, commentaire) {
      const force = refusForce();
      if (force) return force;
      const x = seanceClient(id);
      if (!x) return refus('seance_introuvable');
      if (x.statut !== 'en_cours') return refus('transition_interdite');
      if (ressentiEffort !== null && !consentementSante.accorde) {
        return refus('consentement_sante_absent');
      }
      Object.assign(x, { statut: 'faite', ressentiEffort, commentaire });
      return ok(null);
    },
    async lireMesMesures(): Promise<MesMesures> {
      if (!consentementSante.accorde) throw new Error('consentement_sante_absent');
      return {
        poids: serieDe('poids'),
        tourDeTaille: serieDe('tour_de_taille'),
        seuils: { poids: { min: 20, max: 300 }, tour_de_taille: { min: 40, max: 200 } },
      };
    },
    // Mêmes règles que metriques_seances (0091), sans historique d'accès : le faux n'a pas de
    // pause, toutes ses séances comptent.
    async lireMonSuivi(): Promise<MonSuivi> {
      const jour = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(
        new Date(),
      );
      const decaler = (date: string, jours: number) => {
        const d = new Date(`${date}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + jours);
        return d.toISOString().slice(0, 10);
      };
      const lundiDe = (date: string) =>
        decaler(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
      const lundi = lundiDe(jour);
      const fenetre = seancesClient.filter(
        (x) => x.datePrevue >= decaler(jour, -28) && x.datePrevue <= decaler(jour, -1),
      );
      const poids = fenetre.reduce(
        (n, x) => n + (x.statut === 'faite' ? 1 : x.statut === 'partielle' ? 0.5 : 0),
        0,
      );
      const parSemaine = (l: string) => seancesClient.filter((x) => lundiDe(x.datePrevue) === l);
      const faitesDe = (l: string) => parSemaine(l).filter((x) => x.statut === 'faite').length;
      const semainesPassees = [...new Set(seancesClient.map((x) => lundiDe(x.datePrevue)))]
        .filter((l) => l < lundi)
        .sort()
        .reverse();
      let serie = faitesDe(lundi) > 0 ? 1 : 0;
      for (const l of semainesPassees) {
        const liste = parSemaine(l);
        if (liste.some((x) => x.statut === 'faite')) serie += 1;
        else if (!liste.some((x) => x.statut === 'partielle')) break;
      }
      const dates = seancesClient.map((x) => x.datePrevue).sort();
      return {
        seancesFaites: seancesClient.filter((x) => x.statut === 'faite').length,
        depuis: dates[0] ?? null,
        assiduite: fenetre.length < 4 ? null : Math.round((100 * poids) / fenetre.length),
        serie,
        semaines: [7, 6, 5, 4, 3, 2, 1, 0].map((k) => {
          const l = decaler(lundi, -7 * k);
          return { lundi: l, faites: faitesDe(l), prevues: parSemaine(l).length };
        }),
      };
    },
    async enregistrerMesure(type, valeur, cle) {
      const force = refusForce();
      if (force) return force;
      if (!consentementSante.accorde) return refus('consentement_sante_absent');
      if (
        !Number.isFinite(valeur) ||
        valeur <= 0 ||
        valeur > 1000 ||
        Math.round(valeur * 10) !== valeur * 10
      ) {
        return refus('mesure_invalide');
      }
      const enUnite = Math.round(valeur * facteurMesure[type]);
      if (clesMesures.has(cle)) {
        const deja = mesures.find((m) => m.cle === cle);
        return deja && deja.type === type && deja.valeur === enUnite
          ? ok(deja.id)
          : refus('cle_idempotence_reutilisee');
      }
      clesMesures.add(cle);
      const id = nouvelId('mesure');
      // Le jour à Paris, comme le serveur (et comme la pause plus haut dans ce fichier).
      const le = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
      mesures.push({ id, type, valeur: enUnite, le, cle });
      return ok(id);
    },
    lireProgrammesPourTest() {
      return programmes.map(resume);
    },
    async lireMesProgrammes() {
      return programmes.map(resume).reverse();
    },
    async creerProgramme() {
      const force = refusForce();
      if (force) return force;
      const id = nouvelId('programme');
      programmes.push({ id, titre: '', dureeSemaines: 4, statut: 'brouillon' });
      return ok(id);
    },
    async modifierProgramme(id, titre, dureeSemaines) {
      const force = refusForce();
      if (force) return force;
      const programme = brouillon(id);
      if ('issue' in programme) return programme;
      if (dureeSemaines < 1 || dureeSemaines > 12 || titre.length > 80) {
        return refus('programme_invalide');
      }
      if (seancesStudio.some((x) => x.programmeId === id && x.jourRelatif > dureeSemaines * 7)) {
        return refus('duree_trop_courte');
      }
      programme.titre = titre.trim();
      programme.dureeSemaines = dureeSemaines;
      return ok(null);
    },
    async lireSeancesDuProgramme(programmeId) {
      return seancesStudio
        .filter((x) => x.programmeId === programmeId)
        .sort((a, b) => a.jourRelatif - b.jourRelatif)
        .map((x) => ({
          id: x.id,
          titre: x.titre,
          dureeMinutes: x.dureeMinutes,
          jourRelatif: x.jourRelatif,
          nombreExercices: exercicesStudio.filter((e) => e.seanceId === x.id).length,
        }));
    },
    async ajouterSeance(programmeId, jourRelatif) {
      const force = refusForce();
      if (force) return force;
      const programme = brouillon(programmeId);
      if ('issue' in programme) return programme;
      if (jourRelatif < 1 || jourRelatif > programme.dureeSemaines * 7) {
        return refus('jour_hors_programme');
      }
      const id = nouvelId('seance');
      seancesStudio.push({ id, programmeId, titre: '', dureeMinutes: 30, jourRelatif });
      return ok(id);
    },
    async modifierSeance(seanceId, modifs) {
      const force = refusForce();
      if (force) return force;
      const seance = seanceEnBrouillon(seanceId);
      if ('issue' in seance) return seance;
      Object.assign(seance, { ...modifs, titre: modifs.titre.trim() });
      return ok(null);
    },
    async supprimerSeance(seanceId) {
      const force = refusForce();
      if (force) return force;
      const seance = seanceEnBrouillon(seanceId);
      if ('issue' in seance) return seance;
      seancesStudio.splice(seancesStudio.indexOf(seance), 1);
      return ok(null);
    },
    async dupliquerSemaine(programmeId, semaine) {
      const force = refusForce();
      if (force) return force;
      const programme = brouillon(programmeId);
      if ('issue' in programme) return programme;
      if (semaine < 1 || semaine >= programme.dureeSemaines) return refus('jour_hors_programme');
      const sources = seancesStudio.filter(
        (x) =>
          x.programmeId === programmeId &&
          x.jourRelatif > (semaine - 1) * 7 &&
          x.jourRelatif <= semaine * 7,
      );
      for (const source of sources) {
        const id = nouvelId('seance');
        seancesStudio.push({ ...source, id, jourRelatif: source.jourRelatif + 7 });
        for (const e of exercicesStudio.filter((y) => y.seanceId === source.id)) {
          exercicesStudio.push({ ...e, id: nouvelId('exercice'), seanceId: id });
        }
      }
      return ok(sources.length);
    },
    async lireExercices(seanceId) {
      return exercicesStudio
        .filter((x) => x.seanceId === seanceId)
        .sort((a, b) => a.ordre - b.ordre)
        .map(({ seanceId: _seance, ...exercice }) => exercice);
    },
    async ajouterExercice(seanceId, saisie) {
      const force = refusForce();
      if (force) return force;
      const seance = seanceEnBrouillon(seanceId);
      if ('issue' in seance) return seance;
      if (saisie.nom.trim() === '') return refus('exercice_invalide');
      const id = nouvelId('exercice');
      const ordre =
        Math.max(0, ...exercicesStudio.filter((x) => x.seanceId === seanceId).map((x) => x.ordre)) +
        1;
      exercicesStudio.push({ ...saisie, nom: saisie.nom.trim(), id, ordre, seanceId, media: null });
      return ok(id);
    },
    async supprimerExercice(exerciceId) {
      const force = refusForce();
      if (force) return force;
      const exercice = exercicesStudio.find((x) => x.id === exerciceId);
      if (!exercice) return refus('exercice_introuvable');
      const seance = seanceEnBrouillon(exercice.seanceId);
      if ('issue' in seance) return seance;
      exercicesStudio.splice(exercicesStudio.indexOf(exercice), 1);
      return ok(null);
    },
    async deplacerExercice(exerciceId, sens) {
      const force = refusForce();
      if (force) return force;
      const exercice = exercicesStudio.find((x) => x.id === exerciceId);
      if (!exercice) return refus('exercice_introuvable');
      const seance = seanceEnBrouillon(exercice.seanceId);
      if ('issue' in seance) return seance;
      const voisins = exercicesStudio
        .filter((x) => x.seanceId === exercice.seanceId)
        .sort((a, b) => a.ordre - b.ordre);
      const i = voisins.indexOf(exercice);
      const voisin = voisins[sens === 'haut' ? i - 1 : i + 1];
      if (voisin) [exercice.ordre, voisin.ordre] = [voisin.ordre, exercice.ordre];
      return ok(null);
    },
    async joindreMedia(exerciceId, mediaId) {
      const force = refusForce();
      if (force) return force;
      const exercice = exercicesStudio.find((x) => x.id === exerciceId);
      if (!exercice) return refus('exercice_introuvable');
      const seance = seanceEnBrouillon(exercice.seanceId);
      if ('issue' in seance) return seance;
      const media = mediaId ? mediasStudio.find((x) => x.id === mediaId) : null;
      if (mediaId && !media) return refus('media_introuvable');
      exercice.media = media
        ? {
            id: media.id,
            chemin: media.chemin,
            typeMime: media.typeMime,
            nomFichier: media.nomFichier,
          }
        : null;
      return ok(null);
    },
    async publierProgramme(id) {
      const force = refusForce();
      if (force) return force;
      const programme = brouillon(id);
      if ('issue' in programme) return programme;
      if (!coachVerifie) return refus('identite_non_verifiee');
      if (!seancesStudio.some((x) => x.programmeId === id)) return refus('programme_vide');
      programme.statut = 'publie';
      return ok(null);
    },
    async archiverProgramme(id) {
      const force = refusForce();
      if (force) return force;
      const programme = programmes.find((x) => x.id === id);
      if (!programme) return refus('programme_introuvable');
      if (programme.statut !== 'publie') return refus('transition_interdite');
      programme.statut = 'archive';
      return ok(null);
    },
    async revenirEnEdition(id) {
      const force = refusForce();
      if (force) return force;
      const programme = programmes.find((x) => x.id === id);
      if (!programme) return refus('programme_introuvable');
      if (programme.statut !== 'publie') return refus('transition_interdite');
      if ((affectations.get(id)?.size ?? 0) > 0) return refus('retour_edition_interdit');
      programme.statut = 'brouillon';
      return ok(null);
    },
    async lireMesMedias() {
      return [...mediasStudio];
    },
    async deposerMedia(fichier) {
      const force = refusForce();
      if (force) return force;
      const id = nouvelId('media');
      mediasStudio.unshift({
        id,
        chemin: `coach/${id}`,
        nomFichier: fichier.nom,
        typeMime: fichier.typeMime,
        poidsOctets: fichier.poidsOctets,
      });
      return ok(id);
    },
    async supprimerMedia(mediaId) {
      const force = refusForce();
      if (force) return force;
      const i = mediasStudio.findIndex((x) => x.id === mediaId);
      if (i < 0) return refus('media_introuvable');
      mediasStudio.splice(i, 1);
      return ok(null);
    },
    async urlMedia(chemin) {
      return `https://medias.exemple/${chemin}`;
    },
    async lireAbonnesAffectables() {
      return abonnesAffectables;
    },
    async affecterProgramme(programmeId, profilClientId) {
      const force = refusForce();
      if (force) return force;
      const programme = programmes.find((x) => x.id === programmeId);
      if (!programme) return refus('programme_introuvable');
      if (programme.statut !== 'publie') return refus('transition_interdite');
      if ([...affectations.values()].some((clients) => clients.has(profilClientId))) {
        return refus('programme_deja_en_cours');
      }
      affectations.set(
        programmeId,
        (affectations.get(programmeId) ?? new Set()).add(profilClientId),
      );
      return ok(seancesStudio.filter((x) => x.programmeId === programmeId).length);
    },
    async lireFactures() {
      return factures;
    },
    async lireFacture(factureId) {
      return detailsFactures[factureId] ?? null;
    },
    definirFacturesPourTest(liste, details) {
      factures = liste;
      detailsFactures = details;
    },
  } satisfies FauxPortDonnees;
}
