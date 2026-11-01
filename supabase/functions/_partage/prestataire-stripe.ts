// Le prestataire réel des prélèvements d'échéance (P4.8b) : Stripe, paiement hors session sur le
// moyen enregistré au premier paiement (docs/backend.md, « Pas de Stripe Billing »). Seul fichier
// qui traduit un paiement Stripe vers le vocabulaire de _partage/prelevement.ts.
import { type PaiementPrestataire, type Prestataire } from './prelevement.ts';
import { Stripe } from './stripe.ts';

// Le code le plus précis d'abord : decline_code (« insufficient_funds ») avant code
// (« card_declined »).
function codeDeLErreur(erreur: { decline_code?: string | null; code?: string | null } | null) {
  return erreur?.decline_code ?? erreur?.code ?? null;
}

export function paiementDepuisStripe(
  paiement: Stripe.PaymentIntent,
): PaiementPrestataire & { metadonnees: Record<string, string> } {
  return {
    id: paiement.id,
    statut: paiement.status,
    codeRefus: codeDeLErreur(paiement.last_payment_error),
    metadonnees: paiement.metadata ?? {},
  };
}

export function prestataireStripe(stripe: Stripe): Prestataire {
  return {
    async creerPaiement(demande, cleIdempotence) {
      try {
        const paiement = await stripe.paymentIntents.create(
          {
            amount: demande.montantCentimes,
            currency: 'eur',
            customer: demande.client,
            payment_method: demande.moyen,
            payment_method_types: [demande.type === 'carte' ? 'card' : 'sepa_debit'],
            off_session: true,
            confirm: true,
            metadata: demande.metadonnees,
          },
          { idempotencyKey: cleIdempotence },
        );
        return paiementDepuisStripe(paiement);
      } catch (erreur) {
        // Un refus de la banque arrive en ERREUR (carte refusée, authentification exigée), mais
        // le paiement existe chez Stripe : c'est une réponse, pas une panne. Seule une erreur
        // sans paiement (réseau, clé refusée) remonte comme telle.
        if (erreur instanceof Stripe.errors.StripeError && erreur.payment_intent) {
          return {
            id: erreur.payment_intent.id,
            statut: erreur.payment_intent.status,
            codeRefus: codeDeLErreur(erreur),
          };
        }
        throw erreur;
      }
    },
  };
}
