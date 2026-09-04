import type { EtatProfils, PortDonnees, ProfilOnboarding, ResultatEcriture } from './port';

export type FauxPortDonnees = PortDonnees & {
  // Réservé aux tests d'écran, jamais dans PortDonnees ni appelé par un écran — même
  // convention que src/services/auth/faux.ts (verifierEmailPourTest, etc.) : place un compte
  // dans un état donné sans passer par un vrai onboarding ou une vraie bascule d'espace.
  definirEtatProfilsPourTest(etat: EtatProfils): void;

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
function etatParDefaut(): EtatProfils {
  return {
    profilActif: 'client',
    clientExiste: false,
    clientOnboardingEtape: null,
    coachExiste: false,
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
  let etat: EtatProfils = etatParDefaut();
  let profilOnboarding: ProfilOnboarding = profilOnboardingVide();
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

    async enregistrerPointDeDepart({ consentementAccorde, poidsDepartGrammes, poidsCibleGrammes }) {
      return ecrire(
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
    },

    async terminerOnboarding() {
      return ecrire({ ...etat, clientOnboardingEtape: 5 }, profilOnboarding);
    },
  } satisfies FauxPortDonnees;
}
