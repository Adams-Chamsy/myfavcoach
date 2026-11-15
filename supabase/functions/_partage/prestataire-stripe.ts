// Le prestataire réel des prélèvements d'échéance (P4.8b) : Stripe, paiement hors session sur le
// moyen enregistré au premier paiement (docs/backend.md, « Pas de Stripe Billing »). Seul fichier
// qui traduit un paiement Stripe vers le vocabulaire de _partage/prelevement.ts.
import { type PaiementPrestataire, type Prestataire } from './prelevement.ts';
import { type Encaissement, type PrestataireRapprochement } from './rapprochement.ts';
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

// Le rapprochement quotidien (P4.11a, _partage/rapprochement.ts) : ce que Stripe a encaissé, sous
// la référence que porte la facture chez nous.
//   - une échéance (paiement hors session, métadonnée echeance_le) : le paiement lui-même, pi_… ;
//   - une souscription : la session de paiement qui a créé ce paiement, cs_… ;
//   - un paiement sans l'une ni l'autre (créé à la main dans le tableau de bord, par exemple) :
//     le paiement lui-même — aucune facture ne le portera, et c'est ce qu'il faut signaler.
function introuvable(erreur: unknown): boolean {
  return erreur instanceof Stripe.errors.StripeInvalidRequestError && erreur.statusCode === 404;
}

export function rapprochementStripe(stripe: Stripe): PrestataireRapprochement {
  return {
    async listerEncaissements(depuis, jusqua) {
      const encaissements: Encaissement[] = [];
      const paiements = stripe.paymentIntents.list({
        created: { gte: depuis, lt: jusqua },
        limit: 100,
      });
      for await (const paiement of paiements) {
        if (paiement.status !== 'succeeded') continue;
        let reference = paiement.id;
        if (!paiement.metadata?.echeance_le) {
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paiement.id,
            limit: 1,
          });
          reference = sessions.data[0]?.id ?? paiement.id;
        }
        encaissements.push({ reference, montantCentimes: paiement.amount_received });
      }
      return encaissements;
    },
    async lireEncaissement(reference) {
      try {
        if (reference.startsWith('cs_')) {
          const session = await stripe.checkout.sessions.retrieve(reference);
          return session.payment_status === 'paid' ? session.amount_total : null;
        }
        const paiement = await stripe.paymentIntents.retrieve(reference);
        return paiement.status === 'succeeded' ? paiement.amount_received : null;
      } catch (erreur) {
        // Une référence que Stripe ne connaît pas n'est pas une panne : c'est la réponse.
        if (introuvable(erreur)) return null;
        throw erreur;
      }
    },
  };
}
