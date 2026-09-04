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

  // expo-secure-store n'a aucune implémentation web (voir le commentaire de
  // stockage-securise.ts) : sans ce repli, l'application entière plante à l'ouverture sur web
  // — trouvé via npm run verif:serveur. Jamais AsyncStorage/localStorage en repli : le web
  // n'est pas une cible du produit (CLAUDE.md §1), une session qui ne survit pas au
  // rechargement y est honnête, pas un bug.
  it("n'écrit rien nulle part et lit toujours null, sans jamais toucher expo-secure-store", async () => {
    jest.resetModules();
    // jest.resetModules() vide aussi le registre de 'react-native' : le Platform importé en
    // haut de ce fichier référence désormais une instance PÉRIMÉE, découplée de celle que
    // stockage-securise.ts va charger juste après. Il faut remuter la copie FRAÎCHE.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- doit suivre resetModules
    const PlatformFrais = require('react-native').Platform;
    PlatformFrais.OS = 'web';
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir plus haut
    const SecureStore = require('expo-secure-store');
    const espionEcriture = jest.spyOn(SecureStore, 'setItemAsync');
    const espionLecture = jest.spyOn(SecureStore, 'getItemAsync');

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- voir plus haut
    const { stockageSecurise } = require('./stockage-securise');

    await stockageSecurise.setItem('session-test', 'une-valeur');
    expect(await stockageSecurise.getItem('session-test')).toBeNull();
    await stockageSecurise.removeItem('session-test');

    expect(espionEcriture).not.toHaveBeenCalled();
    expect(espionLecture).not.toHaveBeenCalled();
  });
});
