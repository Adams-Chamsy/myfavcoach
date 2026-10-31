// Les deux clients Postgres (docs/backend.md §12, « Authentification contre Postgres »), toujours
// nommés explicitement, jamais un client unique réutilisé pour les deux :
//   - clientDuClient : agit EN TANT QUE l'utilisateur (son jeton) -- auth.uid() vaut son
//     identifiant, la RLS et les grants à `authenticated` s'appliquent ;
//   - clientServeur : service_role, pour ce que seul le serveur a le droit de faire.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.4';
import { lireSecret } from './environnement.ts';

export type ClientPostgres = SupabaseClient;

export function clientServeur(): ClientPostgres {
  return createClient(lireSecret('SUPABASE_URL'), lireSecret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// L'en-tête Authorization de la requête entrante est transmis TEL QUEL : la fonction ne lit ni
// ne décode le jeton, Postgres le fait (verify_jwt l'a déjà validé à l'entrée).
export function clientDuClient(autorisation: string): ClientPostgres {
  return createClient(lireSecret('SUPABASE_URL'), lireSecret('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Message d'une exception levée par une fonction SQL (`raise exception 'offre_indisponible'`) :
// PostgREST le rend dans error.message. Toute autre erreur (réseau, délai) n'a pas de code
// métier : null.
export function codeMetier(erreur: { message?: string; code?: string } | null): string | null {
  if (!erreur) return null;
  return erreur.code === 'P0001' && erreur.message ? erreur.message : null;
}
