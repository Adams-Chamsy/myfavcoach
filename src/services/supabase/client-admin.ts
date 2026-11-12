import { createClient } from '@supabase/supabase-js';

// L2-10/docs/backend.md §9 : client DÉDIÉ à app/(admin)/, jamais src/services/supabase/client.ts
// (celui embarqué dans le paquet mobile). EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY porte la clé
// "publishable" (sb_publishable_…, nouveau système de clés Supabase) — un enregistrement
// distinct de la clé "anon" legacy que lit le client mobile, jamais un simple renommage de la
// même valeur (.env.exemple).
//
// Session en MÉMOIRE, le temps de la page (décidé le 12 novembre 2026 : « un examinateur lit des
// pièces d'identité ») — jamais sur le disque du navigateur. Corrigé le même jour : ce client ne
// recevait aucun `storage`, et supabase-js prenait alors le localStorage du navigateur par défaut,
// alors que ce commentaire affirmait le contraire. Une clé de stockage propre : même projet que
// l'application, donc même clé par défaut, et les deux clients se seraient répondu dans la page.
function exigerVariable(nomAffiche: string, valeur: string | undefined): string {
  if (!valeur) {
    throw new Error(`Variable d'environnement manquante : ${nomAffiche}.`);
  }
  return valeur;
}

const url = exigerVariable('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
const cleAdmin = exigerVariable(
  'EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY,
);

const memoire = new Map<string, string>();

export const supabaseAdmin = createClient(url, cleAdmin, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'mfc-back-office',
    storage: {
      getItem: (cle: string) => memoire.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => {
        memoire.set(cle, valeur);
      },
      removeItem: (cle: string) => {
        memoire.delete(cle);
      },
    },
  },
});
