// Lecture du moyen de paiement d'une session (P4.5c, docs/dette.md « moyenUtilise rend null sur un
// prélèvement SEPA rejeté »). Lancé par `npm run verif:fonctions` (deno test).
//
// Les objets ci-dessous sont des sessions RÉELLES du bac à sable « My Fav Coach », relues le
// 31 octobre 2026 avec la même expansion que relireSession, réduites aux champs que ce module
// lit. Ce qu'elles montrent (relu chez Stripe, pas supposé) :
//   - SEPA rejeté (cs_test_a1bJqkE8…, IBAN FR7920041010050500013M02600) : payment_method vaut
//     null, le type reste dans latest_charge.payment_method_details et dans
//     last_payment_error.payment_method ;
//   - carte payée (cs_test_a1xKJFNZ…) et SEPA confirmé (cs_test_a17SWHsv…) : payment_method
//     renseigné.
import { deepStrictEqual, strictEqual } from 'node:assert';
import { type ClientPostgres } from './postgres.ts';
import { moyenUtilise, synchroniserSession } from './session-paiement.ts';
import { type Stripe } from './stripe.ts';

// Les fixtures ne portent que les champs lus : le cast est voulu, un objet Stripe complet
// noierait ce que le test prouve.
const paiement = (champs: Record<string, unknown>): Stripe.PaymentIntent =>
  champs as unknown as Stripe.PaymentIntent;

const CARTE_PAYEE = paiement({
  status: 'succeeded',
  payment_method: { type: 'card' },
  latest_charge: { payment_method_details: { type: 'card' } },
  last_payment_error: null,
});
const SEPA_CONFIRME = paiement({
  status: 'succeeded',
  payment_method: { type: 'sepa_debit' },
  latest_charge: { payment_method_details: { type: 'sepa_debit' } },
  last_payment_error: null,
});
const SEPA_REJETE = paiement({
  status: 'requires_payment_method',
  payment_method: null,
  latest_charge: { payment_method_details: { type: 'sepa_debit' } },
  last_payment_error: {
    code: 'payment_intent_payment_attempt_failed',
    payment_method: { type: 'sepa_debit' },
  },
});

Deno.test('carte payée : carte', () => {
  strictEqual(moyenUtilise(CARTE_PAYEE), 'carte');
});

Deno.test('SEPA confirmé : sepa', () => {
  strictEqual(moyenUtilise(SEPA_CONFIRME), 'sepa');
});

Deno.test('SEPA rejeté réel (payment_method vide) : sepa', () => {
  strictEqual(moyenUtilise(SEPA_REJETE), 'sepa');
});

Deno.test('SEPA rejeté, erreur effacée par une mise à jour : sepa lu sur le débit', () => {
  strictEqual(moyenUtilise(paiement({ ...SEPA_REJETE, last_payment_error: null })), 'sepa');
});

Deno.test('SEPA rejeté, débit non étendu : sepa lu sur l’erreur', () => {
  strictEqual(moyenUtilise(paiement({ ...SEPA_REJETE, latest_charge: 'py_essai' })), 'sepa');
});

Deno.test('les trois sources vides : indetermine, jamais une déduction', () => {
  const vide = paiement({ ...SEPA_REJETE, latest_charge: null, last_payment_error: null });
  strictEqual(moyenUtilise(vide), 'indetermine');
});

Deno.test('un type lu qui n’est ni carte ni SEPA : autre', () => {
  strictEqual(
    moyenUtilise(paiement({ ...CARTE_PAYEE, payment_method: { type: 'link' } })),
    'autre',
  );
});

// --- Chemin complet jusqu'à la base, avec un faux client Postgres qui note les appels. ---

type Appel = { fonction: string; arguments: Record<string, unknown> };

function fauxServeur(appels: Appel[]): ClientPostgres {
  const faux = {
    rpc: (fonction: string, args: Record<string, unknown>) => {
      appels.push({ fonction, arguments: args });
      return Promise.resolve({
        data: fonction === 'synchroniser_session_paiement' ? 'abonne' : null,
        error: null,
      });
    },
  };
  // Seule rpc est appelée par synchroniserSession : le reste du client n'a pas lieu d'exister ici.
  return faux as unknown as ClientPostgres;
}

const session = (pi: Stripe.PaymentIntent): Stripe.Checkout.Session =>
  ({
    id: 'cs_test_a1bJqkE8vEufXRXt5aDCUmvuvbt1AlTZbT3xwtrNSYbaVJWerFQ3GChfAH',
    status: 'complete',
    payment_status: 'unpaid',
    amount_total: 4900,
    customer: null,
    metadata: { intention_id: '6841f036-237a-48ba-b116-8569998b715c' },
    payment_intent: pi,
  }) as unknown as Stripe.Checkout.Session;

Deno.test(
  'SEPA rejeté réel : la base reçoit sepa et paiement échoué, aucune anomalie',
  async () => {
    const appels: Appel[] = [];
    const resultat = await synchroniserSession(fauxServeur(appels), session(SEPA_REJETE), null);
    deepStrictEqual(resultat, { type: 'resultat', resultat: 'abonne' });
    deepStrictEqual(
      appels.map((a) => [a.fonction, a.arguments.p_moyen, a.arguments.p_paiement_echoue]),
      [['synchroniser_session_paiement', 'sepa', true]],
    );
  },
);

Deno.test('les trois sources vides : anomalie moyen_indetermine, rien de métier', async () => {
  const appels: Appel[] = [];
  const vide = paiement({ ...SEPA_REJETE, latest_charge: null, last_payment_error: null });
  const resultat = await synchroniserSession(fauxServeur(appels), session(vide), null);
  deepStrictEqual(resultat, { type: 'incoherence', motif: 'moyen_indetermine' });
  deepStrictEqual(
    appels.map((a) => [a.fonction, a.arguments.p_motif]),
    [['enregistrer_anomalie_paiement', 'moyen_indetermine']],
  );
});

// P4.8b (0046) : le moyen de paiement du premier paiement est conservé, pour les échéances.
Deno.test('carte payée : le moyen de paiement est conservé après la synchronisation', async () => {
  const appels: Appel[] = [];
  const carte = paiement({
    status: 'succeeded',
    payment_method: { id: 'pm_carte', type: 'card' },
    latest_charge: { payment_method_details: { type: 'card' } },
    last_payment_error: null,
  });
  const s = {
    ...(session(carte) as unknown as Record<string, unknown>),
    payment_status: 'paid',
  } as unknown as Stripe.Checkout.Session;
  await synchroniserSession(fauxServeur(appels), s, null);
  deepStrictEqual(
    appels.map((a) => [a.fonction, a.arguments.p_moyen_prestataire ?? null]),
    [
      ['synchroniser_session_paiement', null],
      ['memoriser_moyen_paiement', 'pm_carte'],
    ],
  );
});

Deno.test('moyen retiré (SEPA rejeté) : rien à conserver, aucun appel', async () => {
  const appels: Appel[] = [];
  await synchroniserSession(fauxServeur(appels), session(SEPA_REJETE), null);
  deepStrictEqual(
    appels.map((a) => a.fonction),
    ['synchroniser_session_paiement'],
  );
});
