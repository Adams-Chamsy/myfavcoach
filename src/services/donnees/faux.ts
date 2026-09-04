import type { EtatProfils, PortDonnees } from './port';

export type FauxPortDonnees = PortDonnees & {
  // Réservé aux tests d'écran, jamais dans PortDonnees ni appelé par un écran — même
  // convention que src/services/auth/faux.ts (verifierEmailPourTest, etc.) : place un compte
  // dans un état donné sans passer par un vrai onboarding ou une vraie bascule d'espace.
  definirEtatProfilsPourTest(etat: EtatProfils): void;
};

// docs/api.md §3 : un compte neuf a toujours profilActif = 'client' (colonne NOT NULL, défaut
// 'client', posée à la création — voir 0001_creer_identite.sql), même sans aucun profil. C'est
// donc l'état par défaut le plus honnête de ce faux, pas 'coach' ni une valeur inventée.
function etatParDefaut(): EtatProfils {
  return { profilActif: 'client', clientExiste: false, coachExiste: false };
}

// Faux en mémoire : créé par test, jeté par test (CLAUDE.md — règle de L0 : aucune dépendance à
// une restauration globale entre tests).
export function creerFauxPortDonnees(): FauxPortDonnees {
  let etat: EtatProfils = etatParDefaut();

  return {
    async lireEtatProfils() {
      return etat;
    },

    definirEtatProfilsPourTest(nouvelEtat) {
      etat = nouvelEtat;
    },
  } satisfies FauxPortDonnees;
}
