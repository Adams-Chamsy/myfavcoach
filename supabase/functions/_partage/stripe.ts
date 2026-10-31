// Client Stripe des Edge Functions (dépendance accordée le 28 septembre 2026, docs/backend.md §13 :
// SDK serveur, jamais dans le paquet mobile).
//
// Version du SDK et version de l'API FIGÉES : une montée de version se décide, elle ne se subit
// pas. 22.6.2 plutôt que 23.0.0 (sortie le 1er octobre 2026, version majeure de deux jours) ; sa
// version d'API est celle que le SDK déclare lui-même (lu dans son code, cjs/apiVersion.js).
import Stripe from 'npm:stripe@22.6.2';
import { lireSecret } from './environnement.ts';

export { Stripe };

export const VERSION_API_STRIPE = '2026-08-26.dahlia';

export function clientStripe(): Stripe {
  return new Stripe(lireSecret('STRIPE_SECRET_KEY'), {
    apiVersion: VERSION_API_STRIPE,
    // Deno n'a pas le module http de Node : le SDK passe par fetch.
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Une erreur de Stripe qui ne passera jamais à l'identique : requête invalide, objet introuvable.
// PAS une clé refusée ni un droit manquant sur la clé restreinte : ceux-là se réparent de notre
// côté, et la relivraison suivante passera -- 5xx, comme une panne réseau ou une limite de débit
// (docs/backend.md §12, « 5xx seulement quand un nouvel essai pourrait réussir »).
//
// Piège : la documentation Stripe (Clés API limitées) dit qu'un droit manquant sur une clé
// restreinte rend une « erreur de requête invalide », avec un statut 403 -- la même classe qu'une
// vraie requête invalide. Le statut les départage : 401 et 403 se réparent, jamais définitifs.
export function erreurStripeDefinitive(erreur: unknown): boolean {
  return (
    erreur instanceof Stripe.errors.StripeInvalidRequestError &&
    erreur.statusCode !== 401 &&
    erreur.statusCode !== 403
  );
}

// Ce qu'un journal peut porter d'une erreur Stripe : son type, son code, le paramètre en cause et
// l'identifiant de la requête chez Stripe -- qui retrouve l'appel dans les journaux de la clé
// (tableau de bord, « Afficher les logs de requêtes ») et y lit, s'il en manque un, le droit
// exact. Jamais le message complet : il peut citer la clé (masquée) ou des valeurs envoyées.
export function descriptionErreurStripe(erreur: unknown): string | null {
  if (!(erreur instanceof Stripe.errors.StripeError)) return null;
  return [
    'stripe',
    erreur.type,
    erreur.code ?? '-',
    erreur.param ?? '-',
    erreur.statusCode ?? '-',
    erreur.requestId ?? '-',
  ].join(':');
}
