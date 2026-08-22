import * as SecureStore from 'expo-secure-store';

export type ProfilActif = 'client' | 'coach';

export type Session = {
  jeton: string | null;
  profilActif: ProfilActif | null;
};

// Seul point de lecture du jeton d'authentification de l'application : le trousseau securise
// (Keychain iOS / Keystore Android), jamais AsyncStorage (regle eslint no-restricted-syntax,
// eslint.config.js — CLAUDE.md §10, docs/ecrans/L0-04-demarrage.md, critere 6). L'ecriture
// (connexion, deconnexion) n'existe pas encore : elle arrive avec le reste de l'identite au
// lot L1, sur la forme reelle de la reponse d'authentification, pas sur une supposition faite ici.
const CLE_JETON = 'jeton_authentification';
const CLE_PROFIL_ACTIF = 'profil_actif';

function estProfilActif(valeur: string | null): valeur is ProfilActif {
  return valeur === 'client' || valeur === 'coach';
}

export async function lireSession(): Promise<Session> {
  const [jeton, profilActifBrut] = await Promise.all([
    SecureStore.getItemAsync(CLE_JETON),
    SecureStore.getItemAsync(CLE_PROFIL_ACTIF),
  ]);

  return {
    jeton,
    profilActif: estProfilActif(profilActifBrut) ? profilActifBrut : null,
  };
}
