// L'adaptateur Stripe des prélèvements (P4.8b) : ce qu'il demande, et comment il lit un refus.
// Faux client Stripe ; les erreurs, elles, sont les vraies classes du SDK.
import { deepStrictEqual, rejects } from 'node:assert';
import { prestataireStripe } from './prestataire-stripe.ts';
import { Stripe } from './stripe.ts';

const DEMANDE = {
  montantCentimes: 4900,
  client: 'cus_1',
  moyen: 'pm_1',
  type: 'carte' as const,
  metadonnees: { abonnement_id: 'abo-1', echeance_le: '2026-12-01', tentative_numero: '1' },
};

function fauxStripe(creer: (params: unknown, options: unknown) => Promise<unknown>): Stripe {
  return { paymentIntents: { create: creer } } as unknown as Stripe;
}

Deno.test(
  'demande un paiement hors session, confirmé, sur le moyen conservé, sous la clé donnée',
  async () => {
    const recu: unknown[] = [];
    const stripe = fauxStripe((params, options) => {
      recu.push(params, options);
      return Promise.resolve({
        id: 'pi_ok',
        status: 'succeeded',
        last_payment_error: null,
        metadata: {},
      });
    });
    deepStrictEqual(await prestataireStripe(stripe).creerPaiement(DEMANDE, 'cle-1'), {
      id: 'pi_ok',
      statut: 'succeeded',
      codeRefus: null,
      metadonnees: {},
    });
    deepStrictEqual(recu, [
      {
        amount: 4900,
        currency: 'eur',
        customer: 'cus_1',
        payment_method: 'pm_1',
        payment_method_types: ['card'],
        off_session: true,
        confirm: true,
        metadata: DEMANDE.metadonnees,
      },
      { idempotencyKey: 'cle-1' },
    ]);
  },
);

Deno.test(
  'carte refusée (erreur du SDK avec son paiement) : une réponse, code le plus précis',
  async () => {
    const stripe = fauxStripe(() =>
      Promise.reject(
        new Stripe.errors.StripeCardError({
          type: 'card_error',
          message: 'Your card has insufficient funds.',
          code: 'card_declined',
          decline_code: 'insufficient_funds',
          payment_intent: {
            id: 'pi_ko',
            status: 'requires_payment_method',
          } as Stripe.PaymentIntent,
        }),
      ),
    );
    deepStrictEqual(await prestataireStripe(stripe).creerPaiement(DEMANDE, 'cle-1'), {
      id: 'pi_ko',
      statut: 'requires_payment_method',
      codeRefus: 'insufficient_funds',
    });
  },
);

Deno.test(
  'erreur sans paiement (réseau, clé refusée) : elle remonte, rien n’est inventé',
  async () => {
    const stripe = fauxStripe(() =>
      Promise.reject(
        new Stripe.errors.StripePermissionError({ type: 'invalid_request_error', message: 'clé' }),
      ),
    );
    await rejects(prestataireStripe(stripe).creerPaiement(DEMANDE, 'cle-1'));
  },
);
