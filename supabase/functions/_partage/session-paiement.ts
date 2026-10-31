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

function estIncoherence(code: string | null): code is Incoherence {
  return (INCOHERENCES as readonly string[]).includes(code ?? '');
}

// Valeurs rendues par synchroniser_session_paiement (0038).
export type ResultatSql =
  'deja_traite' | 'non_terminee' | 'expiree' | 'abonne' | 'coach_ecarte' | 'intention_inconnue';

const RESULTATS_SQL: readonly string[] = [
  'deja_traite',
  'non_terminee',
  'expiree',
  'abonne',
  'coach_ecarte',
  'intention_inconnue',
];

export type Synchronisation =
  | { type: 'resultat'; resultat: ResultatSql }
  // Levée par la fonction SQL (ou constatée avant de l'appeler), puis consignée en anomalie.
  | { type: 'incoherence'; motif: Incoherence }
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
  // payment_intent.payment_method : le moyen EFFECTIVEMENT utilisé (carte ou prélèvement), pas
  // la liste des moyens proposés.
  return await stripe.checkout.sessions.retrieve(idSession, {
    expand: ['payment_intent.payment_method'],
  });
}

function moyenUtilise(paiement: Stripe.PaymentIntent | null): 'carte' | 'sepa' | null {
  const methode = paiement?.payment_method;
  if (!methode || typeof methode === 'string') return null;
  if (methode.type === 'card') return 'carte';
  if (methode.type === 'sepa_debit') return 'sepa';
  return null;
}

async function consignerIncoherence(
  serveur: ClientPostgres,
  session: string,
  intention: string,
  motif: Incoherence,
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
  const moyen = moyenUtilise(paiement);

  // Session terminée sans moyen reconnu (ni carte ni prélèvement SEPA) : la page n'en propose pas
  // d'autre, c'est une incohérence -- jamais un 5xx, la relecture rendrait la même chose.
  if (session.status === 'complete' && moyen === null) {
    return consignerIncoherence(serveur, session.id, intention, 'etat_incoherent');
  }

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
  return { type: 'resultat', resultat: data as ResultatSql };
}
