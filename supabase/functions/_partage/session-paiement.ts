// LA lecture d'une session Checkout transmise à synchroniser_session_paiement (0037, 0038) --
// une seule, partagée par abonnement-constat et webhook-paiement, pour que les deux chemins ne
// puissent pas diverger (docs/api.md §7 : le premier des deux crée l'abonnement, le second ne
// fait rien).
//
// Règle 2 de docs/backend.md §12 : l'ÉTAT est toujours relu chez Stripe au moment du traitement,
// jamais pris dans l'événement reçu, qui peut être ancien.
import { type ClientPostgres, codeMetier } from './postgres.ts';
import { type Stripe } from './stripe.ts';

// Les quatre vraies incohérences (docs/backend.md §12) : la fonction SQL lève, rien de métier
// n'est écrit ; l'appelant les consigne en anomalie et n'en fait jamais un 5xx.
const INCOHERENCES = [
  'montant_incoherent',
  'session_incoherente',
  'statut_session_inconnu',
  'etat_incoherent',
] as const;
export type Incoherence = (typeof INCOHERENCES)[number];

// Motifs consignés par CE module, sans que la fonction SQL ait levé : le moyen de paiement
// illisible sur une session terminée (moyenUtilise). Migration 0039.
export type Motif = Incoherence | 'moyen_indetermine';

function estIncoherence(code: string | null): code is Incoherence {
  return (INCOHERENCES as readonly string[]).includes(code ?? '');
}

// Valeurs rendues par synchroniser_session_paiement (0038).
// abonnement_existant (0043) : payé alors qu'un abonnement est déjà en cours chez ce coach --
// anomalie, aucun second abonnement (docs/domaine.md §3.2, règle d'abonnement unique).
export type ResultatSql =
  | 'deja_traite'
  | 'non_terminee'
  | 'expiree'
  | 'abonne'
  | 'coach_ecarte'
  | 'intention_inconnue'
  | 'abonnement_existant';

const RESULTATS_SQL: readonly string[] = [
  'deja_traite',
  'non_terminee',
  'expiree',
  'abonne',
  'coach_ecarte',
  'intention_inconnue',
  'abonnement_existant',
];

export type Synchronisation =
  | { type: 'resultat'; resultat: ResultatSql }
  // Levée par la fonction SQL (ou constatée avant de l'appeler), puis consignée en anomalie.
  | { type: 'incoherence'; motif: Motif }
  // La session ne porte aucune intention de ce dépôt (autre usage du compte Stripe,
  // `stripe trigger`) : rien à faire, rien d'écrit.
  | { type: 'ignoree' };

// Erreur qu'un nouvel essai peut faire passer (base injoignable, délai) : l'appelant répond 5xx.
export class ErreurPassagere extends Error {}

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// L'identifiant d'intention posé par NOUS dans les métadonnées, avec la clé secrète, à la
// création de la session (abonnement-intention). Le client ne peut pas le forger
// (docs/backend.md §13, « un lien ne se déclare jamais par le client »).
export function intentionDeLaSession(session: Stripe.Checkout.Session): string | null {
  const id = session.metadata?.intention_id;
  return id && FORMAT_UUID.test(id) ? id : null;
}

export async function relireSession(
  stripe: Stripe,
  idSession: string,
): Promise<Stripe.Checkout.Session> {
  // Le moyen EFFECTIVEMENT utilisé (carte ou prélèvement), pas la liste des moyens proposés :
  // payment_intent.payment_method, et latest_charge pour le cas où Stripe l'a retiré (moyenUtilise).
  return await stripe.checkout.sessions.retrieve(idSession, {
    expand: ['payment_intent.payment_method', 'payment_intent.latest_charge'],
  });
}

// Lu, jamais déduit. Après un prélèvement SEPA rejeté, Stripe retire le moyen de paiement du
// PaymentIntent (payment_method vaut null, relu sur une vraie session le 31 octobre 2026) ; le
// type reste lisible à deux autres endroits, essayés dans l'ordre de fiabilité de la
// documentation de l'API Stripe :
//   1. payment_method : le moyen attaché, quand il l'est encore ;
//   2. latest_charge.payment_method_details : « Details about the payment method at the time of
//      the transaction » -- la trace du débit tenté, que rien n'efface ;
//   3. last_payment_error.payment_method : « cleared if the PaymentIntent is later updated for
//      any reason » -- dernier recours.
// Les trois vides : 'indetermine', consigné sous son propre motif. Jamais « SEPA puisque ce n'est
// pas une carte » : la page ne propose que ces deux moyens aujourd'hui, pas forcément demain.
export type MoyenLu = 'carte' | 'sepa' | 'autre' | 'indetermine';

function typeLu(source: unknown): string | null {
  if (!source || typeof source !== 'object') return null;
  const type = (source as { type?: unknown }).type;
  return typeof type === 'string' ? type : null;
}

export function moyenUtilise(paiement: Stripe.PaymentIntent | null): MoyenLu {
  const debit = paiement?.latest_charge;
  const type =
    typeLu(paiement?.payment_method) ??
    typeLu(debit && typeof debit !== 'string' ? debit.payment_method_details : null) ??
    typeLu(paiement?.last_payment_error?.payment_method);
  if (type === null) return 'indetermine';
  if (type === 'card') return 'carte';
  if (type === 'sepa_debit') return 'sepa';
  return 'autre';
}

async function consignerIncoherence(
  serveur: ClientPostgres,
  session: string,
  intention: string,
  motif: Motif,
): Promise<Synchronisation> {
  const { error } = await serveur.rpc('enregistrer_anomalie_paiement', {
    p_session: session,
    p_intention_id: intention,
    p_motif: motif,
  });
  // Consigner a échoué (base injoignable) : un nouvel essai peut réussir -> 5xx.
  if (error) throw new ErreurPassagere('anomalie_non_enregistree');
  return { type: 'incoherence', motif };
}

export async function synchroniserSession(
  serveur: ClientPostgres,
  session: Stripe.Checkout.Session,
  evenement: { id: string; type: string } | null,
): Promise<Synchronisation> {
  const intention = intentionDeLaSession(session);
  if (!intention) return { type: 'ignoree' };

  const paiement =
    session.payment_intent && typeof session.payment_intent !== 'string'
      ? session.payment_intent
      : null;
  const lu = moyenUtilise(paiement);

  // Session terminée sans moyen exploitable -- jamais un 5xx, la relecture rendrait la même chose
  // (docs/dette.md, « Aucune alerte sur les anomalies de paiement ») :
  //   - aucun type lisible nulle part : moyen_indetermine ;
  //   - un type lu, ni carte ni SEPA : la page n'en propose pas d'autre, etat_incoherent.
  if (session.status === 'complete' && lu === 'indetermine') {
    return consignerIncoherence(serveur, session.id, intention, 'moyen_indetermine');
  }
  if (session.status === 'complete' && lu === 'autre') {
    return consignerIncoherence(serveur, session.id, intention, 'etat_incoherent');
  }
  // Session non terminée (ouverte, expirée) : aucun moyen à transmettre.
  const moyen = lu === 'carte' || lu === 'sepa' ? lu : null;

  const { data, error } = await serveur.rpc('synchroniser_session_paiement', {
    p_evenement_id: evenement?.id ?? null,
    p_evenement_type: evenement?.type ?? null,
    p_intention_id: intention,
    p_session: session.id,
    p_statut_session: session.status,
    p_paiement_recu: session.payment_status === 'paid',
    // Prélèvement SEPA rejeté : la session est terminée (mandat signé), non payée, et le paiement
    // est revenu à « moyen de paiement requis » avec une erreur de la banque.
    p_paiement_echoue:
      session.status === 'complete' &&
      session.payment_status === 'unpaid' &&
      paiement?.status === 'requires_payment_method' &&
      paiement.last_payment_error != null,
    p_moyen: moyen,
    p_montant_centimes: session.amount_total,
    p_client_prestataire: typeof session.customer === 'string' ? session.customer : null,
  });

  if (error) {
    const code = codeMetier(error);
    if (estIncoherence(code)) return consignerIncoherence(serveur, session.id, intention, code);
    // Tout le reste -- base injoignable, délai, invariant violé -- : 5xx. Un invariant violé
    // (coach_non_verifie, commission_non_initialisee...) est un défaut : le 5xx le rend visible.
    throw new ErreurPassagere(code ?? 'synchronisation_echouee');
  }
  if (typeof data !== 'string' || !RESULTATS_SQL.includes(data)) {
    throw new ErreurPassagere('resultat_inattendu');
  }

  // P4.8b (0046) : le moyen de paiement enregistré au premier paiement (setup_future_usage =
  // off_session) est conservé pour les échéances, prélevées hors session. Seulement quand
  // l'abonnement existe et que Stripe nomme encore le moyen — un prélèvement SEPA rejeté l'a
  // retiré, et son abonnement est annulé de toute façon. Posé une fois (la base ignore la suite).
  const moyenEnregistre =
    typeof paiement?.payment_method === 'string'
      ? paiement.payment_method
      : (paiement?.payment_method?.id ?? null);
  if ((data === 'abonne' || data === 'deja_traite') && moyenEnregistre) {
    const conserve = await serveur.rpc('memoriser_moyen_paiement', {
      p_reference_paiement: session.id,
      p_moyen_prestataire: moyenEnregistre,
    });
    // Un nouvel essai (relivraison, constat suivant) peut réussir : 5xx.
    if (conserve.error) throw new ErreurPassagere('moyen_non_conserve');
  }
  return { type: 'resultat', resultat: data as ResultatSql };
}
