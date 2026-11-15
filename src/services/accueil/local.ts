import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { lireRetourCoach, type PortAccueil } from './port';

const CLE_MARQUE = 'mfc.accueil.marque-v1';
const CLE_RETOUR = 'mfc.accueil.retour-v1';

// Sur web, le booléen de présentation est durable, la destination publique est limitée
// à l'onglet. SecureStore n'a pas d'implémentation web : ne jamais l'y appeler.
export const portAccueilLocal: PortAccueil = {
  async lire() {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return { marqueVue: true, retourCoach: null };
      return {
        marqueVue: window.localStorage.getItem(CLE_MARQUE) === '1',
        retourCoach: lireRetourCoach(window.sessionStorage.getItem(CLE_RETOUR)),
      };
    }
    const [vue, retour] = await Promise.all([
      SecureStore.getItemAsync(CLE_MARQUE),
      SecureStore.getItemAsync(CLE_RETOUR),
    ]);
    return { marqueVue: vue === '1', retourCoach: lireRetourCoach(retour) };
  },
  async marquerOuvertureVue() {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(CLE_MARQUE, '1');
    } else {
      await SecureStore.setItemAsync(CLE_MARQUE, '1');
    }
  },
  async enregistrerRetour(retour) {
    if (Platform.OS === 'web') {
      if (retour) window.sessionStorage.setItem(CLE_RETOUR, JSON.stringify(retour));
      else window.sessionStorage.removeItem(CLE_RETOUR);
    } else if (retour) {
      await SecureStore.setItemAsync(CLE_RETOUR, JSON.stringify(retour));
    } else {
      await SecureStore.deleteItemAsync(CLE_RETOUR);
    }
  },
};
