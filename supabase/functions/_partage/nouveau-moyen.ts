// Le changement de moyen de paiement après un refus (étape serveur de L4, 14 novembre 2026 ;
// docs/api.md §7, POST /abonnements/{id}/moyen-paiement ; docs/ecrans/L4-20-paiement-refuse.md).
//
// Une page Stripe hébergée en mode « enregistrement » (Checkout, mode = setup) enregistre le
// nouveau moyen sur le client Stripe de l'abonnement ; LA lecture de cette session, partagée par
// le webhook et le constat (même règle que session-paiement.ts : le premier des deux qui arrive
// remplace le moyen, le second ne fait rien -- remplacer_moyen_paiement est idempotent, 0060).
// L'état est toujours relu chez Stripe (docs/backend.md §12, règle 2).
import { type ClientPostgres, codeMetier } from './postgres.ts';
import { ErreurPassagere } from './session-paiement.ts';
import { type Stripe } from './stripe.ts';

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// L'identifiant d'abonnement posé par NOUS dans les métadonnées, avec la clé secrète, à la
// création de la session (abonnement-moyen-paiement). Le client ne peut pas le forger.
export function abonnementDeLaSession(session: Stripe.Checkout.Session): string | null {
  const id = session.metadata?.abonnement_id;
  return session.metadata?.usage === 'nouveau_moyen' && id && FORMAT_UUID.test(id) ? id : null;
}

export async function relireSessionNouveauMoyen(
  stripe: Stripe,
  idSession: string,
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.retrieve(idSession, {
    expand: ['setup_intent.payment_method'],
  });
}

export type MoyenEnregistre = {
  id: string;
  type: 'carte' | 'sepa';
  // Les quatre derniers chiffres de la carte ou de l'IBAN ; null si Stripe ne les donne pas.
  derniersChiffres: string | null;
};

// Lu sur le moyen attaché à l'intention d'enregistrement, jamais déduit. Un type que la page ne
// propose pas (ni carte ni prélèvement) : null, rien n'est écrit.
export function moyenDeLaSession(session: Stripe.Checkout.Session): MoyenEnregistre | null {
  const intention = session.setup_intent;
  if (!intention || typeof intention === 'string') return null;
  const moyen = intention.payment_method;
  if (!moyen || typeof moyen === 'string') return null;
  const chiffres = (valeur: unknown) =>
    typeof valeur === 'string' && /^[0-9]{4}$/.test(valeur) ? valeur : null;
  if (moyen.type === 'card') {
    return {
      id: moyen.id,
      type: 'carte',
      derniersChiffres: chiffres(moyen.card?.last4),
    };
  }
  if (moyen.type === 'sepa_debit') {
    return {
      id: moyen.id,
      type: 'sepa',
      derniersChiffres: chiffres(moyen.sepa_debit?.last4),
    };
  }
  return null;
}

export type ResultatNouveauMoyen =
  // La session ne porte aucun abonnement de ce dépôt, ou n'est pas une session d'enregistrement.
  | { type: 'ignoree' }
  // Page quittée avant la fin, encore ouverte ou expirée : rien d'écrit.
  | { type: 'non_terminee' }
  | { type: 'expiree' }
  // Session terminée sans moyen lisible : rien d'écrit, consigné au journal (jamais un 5xx :
  // la relecture rendrait la même chose).
  | { type: 'moyen_illisible' }
  // Le moyen remplace l'ancien ; la relance programmée (AAAA-MM-JJ), ou null si l'abonnement
  // n'était plus en défaut de paiement.
  | { type: 'enregistre'; prochaineTentativeLe: string | null };

export async function appliquerNouveauMoyen(
  serveur: ClientPostgres,
  session: Stripe.Checkout.Session,
): Promise<ResultatNouveauMoyen> {
  if (session.mode !== 'setup') return { type: 'ignoree' };
  const abonnement = abonnementDeLaSession(session);
  if (!abonnement) return { type: 'ignoree' };
  if (session.status === 'open') return { type: 'non_terminee' };
  if (session.status === 'expired') return { type: 'expiree' };
  const moyen = moyenDeLaSession(session);
  if (!moyen) return { type: 'moyen_illisible' };

  const { data, error } = await serveur.rpc('remplacer_moyen_paiement', {
    p_abonnement_id: abonnement,
    p_moyen_prestataire: moyen.id,
    p_type: moyen.type,
    p_derniers_chiffres: moyen.derniersChiffres,
  });
  // Base injoignable, abonnement disparu entre-temps : un nouvel essai (relivraison, constat
  // suivant) peut passer ou confirmer l'absence -> 5xx.
  if (error) {
    throw new ErreurPassagere(codeMetier(error) ?? 'moyen_non_remplace');
  }
  return {
    type: 'enregistre',
    prochaineTentativeLe: typeof data === 'string' ? data : null,
  };
}
