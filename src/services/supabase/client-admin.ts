import { createClient } from '@supabase/supabase-js';

// L2-10/docs/backend.md §9 : client DÉDIÉ à app/(admin)/, jamais src/services/supabase/client.ts
// (celui embarqué dans le paquet mobile). EXPO_PUBLIC_SUPABASE_ADMIN_ANON_KEY porte la clé
// "publishable" (sb_publishable_…, nouveau système de clés Supabase) — un enregistrement
// distinct de la clé "anon" legacy que lit le client mobile, jamais un simple renommage de la
// même valeur (.env.exemple). Aucune session persistée sur disque partagé avec l'application
// mobile : pas de stockageSecurise ici, un examinateur se reconnecte à chaque lancement plutôt
// que de risquer de mélanger deux sessions dans le même stockage.
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

export const supabaseAdmin = createClient(url, cleAdmin, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
