import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

// Supabase utilise Web Crypto pour le défi PKCE. Expo fournit les opérations natives
// quand le moteur JavaScript ne fournit pas lui-même SHA-256 et le générateur aléatoire.
export function preparerCryptoPkce() {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
  }
  const cryptoActuelle = globalThis.crypto;
  if (typeof cryptoActuelle.getRandomValues !== 'function') {
    Object.defineProperty(cryptoActuelle, 'getRandomValues', { value: getRandomValues });
  }
  if (!cryptoActuelle.subtle) {
    Object.defineProperty(cryptoActuelle, 'subtle', {
      value: {
        digest: (algorithme: string, donnees: BufferSource) => {
          if (algorithme !== 'SHA-256') throw new Error('Algorithme PKCE inattendu');
          return digest(CryptoDigestAlgorithm.SHA256, donnees);
        },
      },
    });
  }
}
