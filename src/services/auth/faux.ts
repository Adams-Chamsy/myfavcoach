import type { ErreurAuth, PortAuth, SessionAuth } from './port';

const AGE_MINIMUM_ANNEES = 18;
// Réplique le seuil réel (docs/api.md §1 : "10/minute sur l'authentification") sans
// dépendre d'une horloge : un compte par tentatives, pas par minute glissante — suffisant
// pour qu'un écran teste son propre affichage "trop d'essais", pas pour mesurer un vrai débit.
const SEUIL_TENTATIVES_AVANT_LIMITE = 10;

type CompteFaux = {
  compteId: string;
  email: string;
  motDePasse: string;
  dateNaissance: string;
  emailVerifie: boolean;
  // Réutilise compteId comme "code" du lien de vérification : suffisant pour ce faux (unique
  // par compte), jamais une hypothèse sur la vraie forme du code Supabase (voir supabase.ts).
  lienExpire: boolean;
};

// N'analyse JAMAIS la date de naissance via `new Date(dateNaissance)` : une chaîne "AAAA-MM-JJ"
// est interprétée comme minuit UTC, puis relue avec des accesseurs LOCAUX (getFullYear,
// getMonth, getDate) — sur un appareil réglé dans un fuseau en arrière de l'UTC, minuit UTC
// tombe encore la veille en heure locale, décalant la date de naissance d'un jour (piège trouvé
// en écrivant faux.test.ts, pas hypothétique). Comparaison en entiers, jamais via un second objet
// Date construit depuis la chaîne : seule la date du jour utilise l'heure locale de l'appareil,
// exactement ce qui est voulu pour "quel âge a cette personne aujourd'hui, où qu'elle soit".
function calculerAge(dateNaissance: string): number {
  const [anneeNaissance, moisNaissance, jourNaissance] = dateNaissance.split('-').map(Number);
  const aujourdHui = new Date();
  const annee = aujourdHui.getFullYear();
  const mois = aujourdHui.getMonth() + 1;
  const jour = aujourdHui.getDate();

  let age = annee - anneeNaissance;
  const pasEncoreAnniversaireCetteAnnee =
    mois < moisNaissance || (mois === moisNaissance && jour < jourNaissance);
  if (pasEncoreAnniversaireCetteAnnee) age -= 1;
  return age;
}

function erreur(code: ErreurAuth['code'], message: string): { succes: false; erreur: ErreurAuth } {
  return { succes: false, erreur: { code, message } };
}

// Réservé aux tests d'écran : jamais dans PortAuth, jamais appelé par un écran. La vraie
// vérification passe par un lien reçu par courriel — inatteignable sans base réelle — donc un
// écran qui doit être testé APRÈS vérification (ex. L1-04, connexion) a besoin d'un moyen direct
// de placer un compte dans cet état, sans passer par un vrai courriel.
export type FauxPortAuth = PortAuth & {
  verifierEmailPourTest(email: string): void;
  // Simule le lien reçu par courriel (docs/ecrans/L1-03-verification-email.md) : un test appelle
  // etablirSessionDepuisLien(port.lienVerificationPourTest(email)) pour jouer le clic.
  lienVerificationPourTest(email: string): string;
  // Simule un lien périmé ou déjà utilisé (critère 3 de la fiche), sans horloge à avancer.
  expirerLienPourTest(email: string): void;
};

// Faux en mémoire : respecte le même contrat que src/services/auth/supabase.ts, y compris ses
// échecs. Créé par test, jeté par test (CLAUDE.md — règle de L0 : aucune dépendance à une
// restauration globale entre tests).
export function creerFauxPortAuth(): FauxPortAuth {
  const comptes = new Map<string, CompteFaux>();
  const tentativesEchoueesParEmail = new Map<string, number>();
  let compteConnecte: CompteFaux | null = null;
  let prochainId = 1;
  const ecouteurs = new Set<(session: SessionAuth | null) => void>();

  function sessionDe(compte: CompteFaux): SessionAuth {
    return {
      compteId: compte.compteId,
      email: compte.email,
      emailVerifie: compte.emailVerifie,
      jetonAcces: `jeton-acces-${compte.compteId}`,
      jetonRafraichissement: `jeton-rafraichissement-${compte.compteId}`,
    };
  }

  function notifier(): void {
    const session = compteConnecte ? sessionDe(compteConnecte) : null;
    for (const ecouteur of ecouteurs) ecouteur(session);
  }

  return {
    async inscrire(email, motDePasse, dateNaissance) {
      // Pas parce que ce port applique la règle des 18 ans (elle est portée par le
      // déclencheur de 0001_creer_identite.sql, jamais dupliquée ici) : parce que l'écran
      // L1-02 doit pouvoir être testé face à ce refus précis sans base réelle.
      if (calculerAge(dateNaissance) < AGE_MINIMUM_ANNEES) {
        return erreur('age_insuffisant', 'My fav Coach est réservé aux majeurs.');
      }

      // Aucune énumération de comptes (docs/ecrans/L1-02, "Aucune énumération de comptes") :
      // une adresse déjà prise rend exactement la même réponse qu'une adresse nouvelle, sans
      // écraser le compte existant.
      if (!comptes.has(email)) {
        comptes.set(email, {
          compteId: `compte-${prochainId++}`,
          email,
          motDePasse,
          dateNaissance,
          emailVerifie: false,
          lienExpire: false,
        });
      }
      return { succes: true };
    },

    async connecter(email, motDePasse) {
      const tentatives = tentativesEchoueesParEmail.get(email) ?? 0;
      if (tentatives >= SEUIL_TENTATIVES_AVANT_LIMITE) {
        return {
          type: 'echec',
          erreur: {
            code: 'limite_debit',
            message: 'Trop d’essais. Réessaie dans quelques minutes.',
          },
        };
      }

      const compte = comptes.get(email);
      if (!compte || compte.motDePasse !== motDePasse) {
        tentativesEchoueesParEmail.set(email, tentatives + 1);
        return {
          type: 'echec',
          erreur: { code: 'identifiants_invalides', message: 'Adresse ou mot de passe incorrect.' },
        };
      }

      tentativesEchoueesParEmail.delete(email);

      if (!compte.emailVerifie) {
        // Ni succès (pas de session) ni échec (docs/ecrans/L1-04 : "n'est pas rejeté").
        return { type: 'email_non_verifie' };
      }

      compteConnecte = compte;
      notifier();
      return { type: 'connecte', session: sessionDe(compte) };
    },

    async deconnecter() {
      compteConnecte = null;
      notifier();
    },

    async renvoyerVerification(_email) {
      // Réponse constante, comme demanderReinitialisation ci-dessous : ce port ne confirme
      // jamais qu'une adresse existe.
      return { succes: true };
    },

    async demanderReinitialisation(_email) {
      return { succes: true };
    },

    async changerMotDePasse(nouveauMotDePasse) {
      if (!compteConnecte) {
        throw new Error(
          'changerMotDePasse appelé sans session active : erreur de l’appelant, pas un échec utilisateur.',
        );
      }
      compteConnecte.motDePasse = nouveauMotDePasse;
      return { succes: true };
    },

    async changerEmail(nouvelEmail) {
      if (!compteConnecte) {
        throw new Error(
          'changerEmail appelé sans session active : erreur de l’appelant, pas un échec utilisateur.',
        );
      }
      comptes.delete(compteConnecte.email);
      compteConnecte.email = nouvelEmail;
      comptes.set(nouvelEmail, compteConnecte);
      return { succes: true };
    },

    async sessionCourante() {
      return compteConnecte ? sessionDe(compteConnecte) : null;
    },

    surChangementDeSession(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => {
        ecouteurs.delete(ecouteur);
      };
    },

    async etablirSessionDepuisLien(url) {
      const code = new URL(url).searchParams.get('code');
      const compte = code ? [...comptes.values()].find((c) => c.compteId === code) : undefined;

      if (!compte) {
        return erreur('serveur', 'On a un souci de notre côté. Ce n’est pas toi.');
      }
      if (compte.lienExpire) {
        return erreur('lien_expire', 'Ce lien a expiré.');
      }

      compte.emailVerifie = true;
      compteConnecte = compte;
      notifier();
      return { succes: true };
    },

    verifierEmailPourTest(email) {
      const compte = comptes.get(email);
      if (!compte) {
        throw new Error(`verifierEmailPourTest : aucun compte pour "${email}".`);
      }
      compte.emailVerifie = true;
    },

    lienVerificationPourTest(email) {
      const compte = comptes.get(email);
      if (!compte) {
        throw new Error(`lienVerificationPourTest : aucun compte pour "${email}".`);
      }
      return `myfavcoach://auth/rappel?code=${compte.compteId}`;
    },

    expirerLienPourTest(email) {
      const compte = comptes.get(email);
      if (!compte) {
        throw new Error(`expirerLienPourTest : aucun compte pour "${email}".`);
      }
      compte.lienExpire = true;
    },
  } satisfies FauxPortAuth;
}
