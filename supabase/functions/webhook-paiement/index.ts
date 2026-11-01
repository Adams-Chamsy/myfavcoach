// Point d'entrée des événements Stripe (docs/backend.md §12 ; docs/api.md §7).
//
// Déployé SANS vérification de jeton Supabase (supabase/config.toml, verify_jwt = false) : Stripe
// n'en a pas. Ce qui le protège, c'est la vérification de signature ci-dessous, AVANT toute
// lecture du contenu -- sans elle, n'importe qui pourrait fabriquer un « paiement réussi ».
//
// Codes de réponse (docs/backend.md §12, « 5xx seulement quand un nouvel essai pourrait
// réussir ») :
//   400 -- signature absente ou invalide : pas Stripe, rien d'écrit ;
//   200 -- tout le reste qui ne changera jamais : traité, déjà traité, ignoré, coach écarté,
//          intention inconnue, incohérence consignée en anomalie ;
//   500 -- seulement ce qu'une relivraison peut faire passer : base ou Stripe injoignables,
//          configuration incomplète.
import { ConfigurationIncomplete, lireSecret } from '../_partage/environnement.ts';
import { conclureDepuisPaiement } from '../_partage/prelevement.ts';
import { clientServeur } from '../_partage/postgres.ts';
import { paiementDepuisStripe } from '../_partage/prestataire-stripe.ts';
import {
  ErreurPassagere,
  relireSession,
  synchroniserSession,
} from '../_partage/session-paiement.ts';
import {
  clientStripe,
  erreurStripeDefinitive,
  Stripe,
  descriptionErreurStripe,
} from '../_partage/stripe.ts';

const TYPES_TRAITES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

// P4.8b : l'issue d'un prélèvement d'échéance hors session (_partage/prelevement.ts). Une carte
// répond sur-le-champ, à la tâche planifiée elle-même ; un prélèvement SEPA répond en différé,
// ici. Les paiements de la page de paiement passent aussi par ces événements : sans métadonnées
// d'échéance, ils sont ignorés (leur session les traite).
const TYPES_PAIEMENT_ECHEANCE = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
]);

function reponse(statut: number, corps: Record<string, string>): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function traiter(requete: Request): Promise<Response> {
  if (requete.method !== 'POST') return reponse(405, { code: 'methode_interdite' });

  // 1. La signature, d'abord. Le corps est lu en TEXTE BRUT, octet pour octet : la signature
  //    porte sur ces octets exacts, et un JSON.parse puis une re-sérialisation la casseraient.
  //    constructEventAsync vérifie la signature ET l'horodatage (tolérance de 300 s : un
  //    événement bien signé mais rejoué des heures plus tard est refusé aussi).
  const signature = requete.headers.get('stripe-signature');
  if (!signature) return reponse(400, { code: 'signature_absente' });
  const corpsBrut = await requete.text();
  const stripe = clientStripe();
  let evenement: Stripe.Event;
  try {
    evenement = await stripe.webhooks.constructEventAsync(
      corpsBrut,
      signature,
      lireSecret('STRIPE_WEBHOOK_SECRET'),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (erreur) {
    if (erreur instanceof ConfigurationIncomplete) throw erreur;
    // Aucun détail renvoyé, aucune écriture, aucun journal du corps.
    return reponse(400, { code: 'signature_invalide' });
  }

  // 2. Seulement maintenant, le contenu -- et seulement l'identifiant et le type de l'événement,
  //    et l'identifiant de la session. L'ÉTAT de la session est relu chez Stripe.
  if (TYPES_PAIEMENT_ECHEANCE.has(evenement.type)) {
    return traiterPaiementEcheance(stripe, evenement);
  }
  if (!TYPES_TRAITES.has(evenement.type)) return reponse(200, { resultat: 'type_ignore' });
  const idSession = (evenement.data.object as { id?: unknown }).id;
  if (typeof idSession !== 'string') return reponse(200, { resultat: 'type_ignore' });

  let session: Stripe.Checkout.Session;
  try {
    session = await relireSession(stripe, idSession);
  } catch (erreur) {
    if (erreurStripeDefinitive(erreur)) {
      // Session introuvable chez Stripe : aucune relivraison ne la fera réapparaître.
      console.error(`webhook-paiement ${evenement.id} : session illisible, ignorée`);
      return reponse(200, { resultat: 'session_illisible' });
    }
    throw erreur;
  }

  const synchronisation = await synchroniserSession(clientServeur(), session, {
    id: evenement.id,
    type: evenement.type,
  });
  switch (synchronisation.type) {
    case 'ignoree':
      return reponse(200, { resultat: 'hors_intention' });
    case 'incoherence':
      // Une erreur, consignée en anomalie : visible au rapprochement, jamais relivrée en boucle.
      console.error(`webhook-paiement ${evenement.id} : ${synchronisation.motif}`);
      return reponse(200, { resultat: 'anomalie', motif: synchronisation.motif });
    case 'resultat':
      return reponse(200, { resultat: synchronisation.resultat });
  }
}

// L'état du paiement est RELU chez Stripe (docs/backend.md §12, règle 2), jamais pris dans
// l'événement, qui peut être ancien. conclure_tentative ne conclut qu'une fois : un événement
// relivré ne refait rien.
async function traiterPaiementEcheance(stripe: Stripe, evenement: Stripe.Event): Promise<Response> {
  const idPaiement = (evenement.data.object as { id?: unknown }).id;
  if (typeof idPaiement !== 'string') return reponse(200, { resultat: 'type_ignore' });
  let paiement: Stripe.PaymentIntent;
  try {
    paiement = await stripe.paymentIntents.retrieve(idPaiement);
  } catch (erreur) {
    if (erreurStripeDefinitive(erreur)) {
      console.error(`webhook-paiement ${evenement.id} : paiement illisible, ignoré`);
      return reponse(200, { resultat: 'paiement_illisible' });
    }
    throw erreur;
  }
  const resultat = await conclureDepuisPaiement(clientServeur(), paiementDepuisStripe(paiement));
  return reponse(200, { resultat });
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    // Seules arrivent ici les erreurs qu'un nouvel essai peut faire passer : 500, Stripe
    // relivrera. Le journal ne porte qu'un code, jamais un corps ni une donnée personnelle.
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'erreur_passagere');
    console.error(`webhook-paiement : ${code}`);
    return reponse(500, { code: 'erreur_passagere' });
  }
});
