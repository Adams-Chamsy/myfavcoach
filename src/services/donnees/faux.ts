import type {
  EtatProfils,
  InformationsCompte,
  ModificationsInformations,
  PortDonnees,
  ProfilOnboarding,
  ResultatEcriture,
} from './port';

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
  } satisfies FauxPortDonnees;
}
