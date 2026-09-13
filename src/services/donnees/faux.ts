import type {
  CommuneReference,
  Discipline,
  DossierVerification,
  EtatProfils,
  InformationsCompte,
  ModificationsInformations,
  ModificationsOffre,
  Offre,
  ParametresRecherche,
  PieceDeposee,
  PortDonnees,
  ProfilCoachPublic,
  ProfilOnboarding,
  ResultatEcriture,
  ResultatRecherche,
  TypePiece,
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
  // publierOffre échoue avec ce code au prochain appel, une seule fois — sert les deux refus
  // testés par L2-15 (coach_non_verifie, engagement_humain_requis).
  echouerProchainePublicationPourTest(code: string): void;
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
  return { profil: 'client', prenom: '', nom: null, dateNaissance: '2000-01-01' };
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
  let profilOnboarding: ProfilOnboarding = profilOnboardingVide();
  let informations: InformationsCompte = informationsCompteParDefaut();
  // État courant du consentement santé (journal réduit à son dernier état, suffisant ici).
  // version null = aucun consentement jamais enregistré.
  let consentementSante: { accorde: boolean; version: string | null } = {
    accorde: false,
    version: null,
  };
  let prochaineEcritureEchoue: string | null = null;
  let dossierVerification: DossierVerification = { statut: 'absente', deposeLe: null, motif: null };
  let piecesDeposees: PieceDeposee[] = [];
  let offres: Offre[] = [];
  let prochainePublicationEchoue: string | null = null;
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

    async creerProfilClient(prenom, nom) {
      return ecrire(
        { ...etat, clientExiste: true, clientOnboardingEtape: 2 },
        { ...profilOnboarding, prenom, nom: nom === '' ? null : nom },
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

    // Pas de règle métier reproduite ici (contrairement au vrai basculer_profil, qui refuse un
    // profil inexistant) : comme les écritures d'onboarding ci-dessus, ce faux ne simule que
    // l'échec générique, via echouerProchaineEcriturePourTest — suffisant pour les tests
    // d'écran de docs/ecrans/L1-06-bascule-espace.md, qui n'exposent cette action que pour un
    // profil déjà connu comme existant (voir le commentaire de PortDonnees.basculerProfil).
    async basculerProfil(profil) {
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
            }
          : modifs.profil === 'client' && informations.profil === 'client'
            ? { ...informations, prenom: modifs.prenom, nom: modifs.nom }
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
      return { succes: true };
    },

    definirDossierVerificationPourTest(dossier) {
      dossierVerification = dossier;
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

    async deposerPieceVerification(type: TypePiece) {
      if (prochaineEcritureEchoue !== null) {
        const erreur = prochaineEcritureEchoue;
        prochaineEcritureEchoue = null;
        return { succes: false, erreur };
      }
      piecesDeposees = [
        ...piecesDeposees.filter((p) => p.type !== type),
        { type, deposeLe: new Date().toISOString() },
      ];
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

    echouerProchainePublicationPourTest(code) {
      prochainePublicationEchoue = code;
    },
    async publierOffre(id: string) {
      if (prochainePublicationEchoue !== null) {
        const code = prochainePublicationEchoue;
        prochainePublicationEchoue = null;
        return { succes: false, code };
      }
      offres = offres.map((o) =>
        o.id === id ? { ...o, publieeLe: new Date().toISOString(), retireeLe: null } : o,
      );
      return { succes: true };
    },

    async retirerOffre(id: string) {
      offres = offres.map((o) => (o.id === id ? { ...o, retireeLe: new Date().toISOString() } : o));
      return { succes: true };
    },

    definirProfilsCoachPublicsPourTest(profils) {
      profilsCoachPublics = profils;
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
  } satisfies FauxPortDonnees;
}
