import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { stockageSecurise } from './stockage-securise';

// Lecture statique obligatoire (process.env.EXPO_PUBLIC_XXX, jamais process.env[nom]) : le
// plugin Babel d'Expo qui embarque ces variables dans le paquet ne reconnaît que cette forme
// exacte, écrite en dur. Un accès dynamique ne serait jamais rempli au build et vaudrait
// toujours `undefined` en production.
function exigerVariable(nomAffiche: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(
      `Variable d'environnement manquante : ${nomAffiche}. Renseigne-la dans .env ` +
        "(voir .env.exemple) avant de démarrer l'application.",
    );
  }
  return valeur;
}

const url = exigerVariable('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
const cleAnonyme = exigerVariable(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

// La clé anonyme est publique par conception (docs/backend.md §5, .env.exemple) : sa
// protection vient des politiques RLS posées sur chaque table, jamais de sa confidentialité.
export const supabase = createClient(url, cleAnonyme, {
  auth: {
    storage: stockageSecurise,
    autoRefreshToken: true,
    persistSession: true,
    // L'application ne reçoit jamais de lien de redirection dans une URL web classique.
    detectSessionInUrl: false,
  },
});
