import * as SecureStore from 'expo-secure-store';

// Forme exacte attendue par `auth.storage` du client Supabase (src/services/supabase/client.ts) :
// getItem/setItem/removeItem, chacun pouvant renvoyer une Promise.
export type AdaptateurStockage = {
  getItem(cle: string): Promise<string | null>;
  setItem(cle: string, valeur: string): Promise<void>;
  removeItem(cle: string): Promise<void>;
};

// Piège réel d'expo-secure-store : une valeur est refusée au-delà de 2048 octets sur Android
// (limite de l'API Keystore sous-jacente), et une session Supabase sérialisée (jeton d'accès,
// jeton de rafraîchissement, métadonnées utilisateur) la dépasse presque toujours. Cet
// adaptateur découpe donc toute valeur en morceaux numérotés, stockés sous des clés dérivées,
// et les recompose à la lecture. Marge large sous 2048 plutôt qu'une limite testée au plus
// juste sur un système qu'on ne contrôle pas (l'overhead réel de l'implémentation native n'est
// documenté nulle part).
const LIMITE_OCTETS_MORCEAU = 1800;

const encodeur = new TextEncoder();

// La limite d'expo-secure-store porte sur des OCTETS, pas des caractères : compter `.length`
// aurait sous-estimé la taille réelle dès qu'un caractère accentué apparaît (une métadonnée de
// session comme "Camille Dupré" — le é seul coûte 2 octets en UTF-8, pas 1). Ce découpage
// avance code point par code point (`for...of`, jamais insensible aux paires de substitution
// UTF-16 comme le serait un `.slice()` par index) et compte les octets réels de chacun, pour
// ne jamais couper un caractère en deux entre deux morceaux.
function decouper(valeur: string): string[] {
  const morceaux: string[] = [];
  let morceauCourant = '';
  let octetsCourant = 0;

  for (const caractere of valeur) {
    const octetsCaractere = encodeur.encode(caractere).length;
    if (octetsCourant + octetsCaractere > LIMITE_OCTETS_MORCEAU && morceauCourant.length > 0) {
      morceaux.push(morceauCourant);
      morceauCourant = '';
      octetsCourant = 0;
    }
    morceauCourant += caractere;
    octetsCourant += octetsCaractere;
  }
  // Toujours au moins un morceau, même pour une chaîne vide : c'est ce qui permet à la lecture
  // de distinguer "valeur vide stockée" (compte = 1) de "rien stocké" (compte = 0).
  morceaux.push(morceauCourant);

  return morceaux;
}

function cleCompte(cle: string): string {
  return `${cle}.compte`;
}

function cleMorceau(cle: string, index: number): string {
  return `${cle}.${index}`;
}

async function lireCompte(cle: string): Promise<number> {
  const brut = await SecureStore.getItemAsync(cleCompte(cle));
  const nombre = brut ? Number.parseInt(brut, 10) : 0;
  return Number.isFinite(nombre) && nombre > 0 ? nombre : 0;
}

// Non atomique : une interruption exactement pendant l'écriture des morceaux (avant que le
// nouveau compte ne soit posé) laisserait un mélange de morceaux neufs et anciens. Accepté ici
// parce qu'une session ainsi corrompue échoue simplement à l'authentification et force une
// reconnexion — jamais un accès avec de mauvaises données. Voir getItem : un morceau manquant
// rend `null` plutôt qu'une valeur tronquée.
export const stockageSecurise: AdaptateurStockage = {
  async getItem(cle) {
    const compte = await lireCompte(cle);
    if (compte === 0) return null;

    const morceaux: string[] = [];
    for (let index = 0; index < compte; index += 1) {
      const morceau = await SecureStore.getItemAsync(cleMorceau(cle, index));
      if (morceau == null) return null;
      morceaux.push(morceau);
    }
    return morceaux.join('');
  },

  async setItem(cle, valeur) {
    const ancienCompte = await lireCompte(cle);
    const morceaux = decouper(valeur);

    for (const [index, morceau] of morceaux.entries()) {
      await SecureStore.setItemAsync(cleMorceau(cle, index), morceau);
    }
    await SecureStore.setItemAsync(cleCompte(cle), String(morceaux.length));

    // Morceaux orphelins : si la nouvelle valeur tient sur moins de morceaux que l'ancienne,
    // les index au-delà du nouveau compte ne sont jamais réécrits par la boucle ci-dessus et
    // resteraient en place indéfiniment sans ce nettoyage.
    for (let index = morceaux.length; index < ancienCompte; index += 1) {
      await SecureStore.deleteItemAsync(cleMorceau(cle, index));
    }
  },

  async removeItem(cle) {
    const compte = await lireCompte(cle);
    for (let index = 0; index < compte; index += 1) {
      await SecureStore.deleteItemAsync(cleMorceau(cle, index));
    }
    await SecureStore.deleteItemAsync(cleCompte(cle));
  },
};
