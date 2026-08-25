import * as SecureStore from 'expo-secure-store';

import { stockageSecurise } from './stockage-securise';

// Simule le magasin natif (Keychain iOS / Keystore Android) en memoire, avec la meme limite
// que documentee pour Android : une valeur de plus de 2048 OCTETS est refusee — mesures en
// octets UTF-8, pas en `.length` (nombre de caracteres) : un mock qui compterait des caracteres
// laisserait passer un decoupage bugue des qu'un morceau contient des caracteres accentues, la
// piege meme que ce fichier verifie. Sans cette limite dans le mock, un adaptateur naif (sans
// decoupage) passerait quand meme le test d'aller-retour ci-dessous.
jest.mock('expo-secure-store', () => {
  const magasin = new Map<string, string>();
  const encodeur = new TextEncoder();
  return {
    getItemAsync: jest.fn(async (cle: string) => (magasin.has(cle) ? magasin.get(cle)! : null)),
    setItemAsync: jest.fn(async (cle: string, valeur: string) => {
      const octets = encodeur.encode(valeur).length;
      if (octets > 2048) {
        throw new Error(`Valeur trop longue pour la clé "${cle}" (${octets} > 2048 octets)`);
      }
      magasin.set(cle, valeur);
    }),
    deleteItemAsync: jest.fn(async (cle: string) => {
      magasin.delete(cle);
    }),
  };
});

describe('stockageSecurise', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Le piege que ce test doit attraper : expo-secure-store refuse toute valeur de plus de
  // 2048 octets sur Android, et une session Supabase le depasse presque toujours. Charge
  // accentuee expres : "Camille Dupré" fait deux octets sur le é (14 octets, 13 caracteres) —
  // un decoupage qui compte des caracteres plutot que des octets sous-estime la taille reelle
  // et laisserait passer un morceau trop lourd pour le magasin natif. 'é' pese exactement 2
  // octets UTF-8 : 3000 repetitions donnent 6000 octets pile, 3000 caracteres seulement.
  it('fait un aller-retour exact sur une valeur accentuée de 6000 octets', async () => {
    const valeur = 'é'.repeat(3000);
    const encodeur = new TextEncoder();
    expect(encodeur.encode(valeur)).toHaveLength(6000);

    await stockageSecurise.setItem('session-test', valeur);

    // Chaque morceau ecrit doit rester sous la limite native EN OCTETS : preuve que le
    // decoupage compte reellement des octets, pas seulement des caracteres.
    const appelsEcriture = (SecureStore.setItemAsync as jest.Mock).mock.calls;
    expect(appelsEcriture.length).toBeGreaterThan(1);
    for (const [, morceauEcrit] of appelsEcriture) {
      expect(encodeur.encode(morceauEcrit as string).length).toBeLessThanOrEqual(2048);
    }

    const relue = await stockageSecurise.getItem('session-test');
    expect(relue).toBe(valeur);
    expect(encodeur.encode(relue!)).toHaveLength(6000);
  });

  it("l'ecriture d'une valeur courte apres une valeur longue ne laisse aucun morceau orphelin", async () => {
    await stockageSecurise.setItem('session-test', 'x'.repeat(6000)); // 4 morceaux (indices 0-3)
    await stockageSecurise.setItem('session-test', 'courte');

    expect(await SecureStore.getItemAsync('session-test.0')).toBe('courte');
    expect(await SecureStore.getItemAsync('session-test.1')).toBeNull();
    expect(await SecureStore.getItemAsync('session-test.2')).toBeNull();
    expect(await SecureStore.getItemAsync('session-test.3')).toBeNull();
    expect(await SecureStore.getItemAsync('session-test.compte')).toBe('1');

    const relue = await stockageSecurise.getItem('session-test');
    expect(relue).toBe('courte');
  });

  it('rend null quand rien n’a été écrit pour cette clé', async () => {
    expect(await stockageSecurise.getItem('cle-jamais-ecrite')).toBeNull();
  });

  it('removeItem efface tous les morceaux et le compte', async () => {
    await stockageSecurise.setItem('session-test', 'z'.repeat(5000));
    await stockageSecurise.removeItem('session-test');

    expect(await SecureStore.getItemAsync('session-test.0')).toBeNull();
    expect(await SecureStore.getItemAsync('session-test.1')).toBeNull();
    expect(await SecureStore.getItemAsync('session-test.compte')).toBeNull();
    expect(await stockageSecurise.getItem('session-test')).toBeNull();
  });
});
