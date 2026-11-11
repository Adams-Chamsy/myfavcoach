import { Platform } from 'react-native';

// Fichier séparé de stockage-securise.test.ts : le choix natif/web se fait au CHARGEMENT du
// module (Platform.OS === 'web' évalué une seule fois, en haut du fichier), donc ce test doit
// forcer Platform.OS AVANT le require, avec jest.resetModules() pour obtenir une évaluation
// fraîche — jamais partagé avec les tests natifs de l'autre fichier, qui chargent le module
// sous Platform.OS = 'ios' (défaut du préréglage jest-expo).
describe('stockageSecurise sur web', () => {
  const plateformeOriginale = Platform.OS;

  afterEach(() => {
    Platform.OS = plateformeOriginale;
    jest.resetModules();
  });

  function chargerSurWeb() {
    jest.resetModules();
    // jest.resetModules() vide aussi le registre de 'react-native' : le Platform importé en
    // haut de ce fichier référence désormais une instance PÉRIMÉE, découplée de celle que
    // stockage-securise.ts va charger juste après. Il faut remuter la copie FRAÎCHE.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- doit suivre resetModules
    const PlatformFrais = require('react-native').Platform;
    PlatformFrais.OS = 'web';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir plus haut
    const SecureStore = require('expo-secure-store');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir plus haut
    const { stockageSecurise } = require('./stockage-securise');
    return { SecureStore, stockageSecurise };
  }

  // Décidé par le développeur le 11 novembre 2026, à la place du repli sans stockage de P1.8 :
  // la session vit le temps de la page, en mémoire. Le repli précédent ne gardait RIEN, et
  // supabase-js relit ce stockage à chaque requête — dès la requête qui suit la connexion, tout
  // partait avec la clé anonyme (trouvé par le navigateur piloté : un coach atterrissait dans
  // l'espace client, « Salut » sans prénom, trois lectures de profil en 401).
  it('garde la session le temps de la page : ce qui est écrit se relit, ce qui est retiré disparaît', async () => {
    const { stockageSecurise } = chargerSurWeb();

    await stockageSecurise.setItem('session-test', 'une-valeur');
    expect(await stockageSecurise.getItem('session-test')).toBe('une-valeur');
    await stockageSecurise.removeItem('session-test');
    expect(await stockageSecurise.getItem('session-test')).toBeNull();
  });

  it('la session disparaît au rechargement de la page (module rechargé)', async () => {
    const { stockageSecurise } = chargerSurWeb();
    await stockageSecurise.setItem('session-test', 'une-valeur');

    const { stockageSecurise: apresRechargement } = chargerSurWeb();
    expect(await apresRechargement.getItem('session-test')).toBeNull();
  });

  // Toujours rien sur le disque du navigateur : ni expo-secure-store (sans implémentation web,
  // il lève), ni localStorage, ni sessionStorage — jamais une VRAIE persistance pour un jeton de
  // session sur une plateforme qui n'est pas une cible du produit (CLAUDE.md §1).
  it("n'écrit jamais ni dans expo-secure-store, ni dans localStorage, ni dans sessionStorage", async () => {
    const espionDisque = { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() };
    const globale = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
    const avant = { local: globale.localStorage, session: globale.sessionStorage };
    globale.localStorage = espionDisque;
    globale.sessionStorage = espionDisque;
    try {
      const { SecureStore, stockageSecurise } = chargerSurWeb();
      const espionEcriture = jest.spyOn(SecureStore, 'setItemAsync');
      const espionLecture = jest.spyOn(SecureStore, 'getItemAsync');

      await stockageSecurise.setItem('session-test', 'une-valeur');
      await stockageSecurise.getItem('session-test');
      await stockageSecurise.removeItem('session-test');

      expect(espionEcriture).not.toHaveBeenCalled();
      expect(espionLecture).not.toHaveBeenCalled();
      expect(espionDisque.setItem).not.toHaveBeenCalled();
      expect(espionDisque.getItem).not.toHaveBeenCalled();
    } finally {
      globale.localStorage = avant.local;
      globale.sessionStorage = avant.session;
    }
  });
});
