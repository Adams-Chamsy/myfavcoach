// Secrets et variables d'environnement des Edge Functions (docs/backend.md §12, §13).
//
// Lus à chaque requête, jamais au chargement du module : une fonction déployée avant que le
// secret soit posé répond 500 proprement (« configuration incomplète ») au lieu de planter au
// démarrage. Un secret n'est JAMAIS écrit dans un journal, même tronqué.

export type NomSecret =
  | 'STRIPE_SECRET_KEY'
  | 'STRIPE_WEBHOOK_SECRET'
  | 'URL_RETOUR_PAIEMENT'
  | 'SUPABASE_URL'
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY';

export class ConfigurationIncomplete extends Error {
  constructor(nom: NomSecret) {
    // Le NOM du secret manquant, jamais une valeur.
    super(`configuration_incomplete:${nom}`);
  }
}

export function lireSecret(nom: NomSecret): string {
  const valeur = Deno.env.get(nom);
  if (!valeur) throw new ConfigurationIncomplete(nom);
  return valeur;
}
