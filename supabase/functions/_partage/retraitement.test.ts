// Retraitement des anomalies de paiement (0040, Edge Function anomalies-retraitement). Lancé par
// `npm run verif:fonctions` (deno test). Faux clients Postgres et fausse relecture Stripe : ce
// qui est prouvé ici, c'est la décision prise pour chaque anomalie ; la preuve contre la vraie
// base et le vrai Stripe est l'essai de P4.5c (docs/prompts/L4.md).
import { deepStrictEqual, rejects } from 'node:assert';
import { type ClientPostgres } from './postgres.ts';
import { type Bilan, RefusAppelant, retraiterAnomalies } from './retraitement.ts';
import { type Stripe } from './stripe.ts';

type Appel = { fonction: string; arguments: Record<string, unknown> };
type Ouverte = { id: string; session_prestataire: string; motif: string };

const ID_INTENTION = '6841f036-237a-48ba-b116-8569998b715c';

// La session SEPA rejetée réelle (cs_test_a1bJqkE8…), réduite aux champs lus : voir
// session-paiement.test.ts pour sa provenance.
const sessionSepaRejetee = (id: string): Stripe.Checkout.Session =>
  ({
    id,
    status: 'complete',
    payment_status: 'unpaid',
    amount_total: 4900,
    customer: null,
    metadata: { intention_id: ID_INTENTION },
    payment_intent: {
      status: 'requires_payment_method',
      payment_method: null,
      latest_charge: { payment_method_details: { type: 'sepa_debit' } },
      last_payment_error: { payment_method: { type: 'sepa_debit' } },
    },
  }) as unknown as Stripe.Checkout.Session;

// La même, sans aucune source lisible pour le moyen de paiement.
const sessionIllisible = (id: string): Stripe.Checkout.Session => {
  const s = sessionSepaRejetee(id) as unknown as { payment_intent: Record<string, unknown> };
  s.payment_intent = { status: 'requires_payment_method', payment_method: null };
  return s as unknown as Stripe.Checkout.Session;
};

// Seule rpc est appelée par le retraitement : le reste du client n'a pas lieu d'exister ici.
function faux(
  appels: Appel[],
  reponses: Record<string, { data: unknown; error: unknown }>,
): ClientPostgres {
  return {
    rpc: (fonction: string, args: Record<string, unknown>) => {
      appels.push({ fonction, arguments: args });
      return Promise.resolve(reponses[fonction] ?? { data: null, error: null });
    },
  } as unknown as ClientPostgres;
}

const appelantQuiListe = (ouvertes: Ouverte[]) =>
  faux([], { anomalies_paiement_ouvertes: { data: ouvertes, error: null } });

const serveurQuiAbonne = (appels: Appel[]) =>
  faux(appels, {
    synchroniser_session_paiement: { data: 'abonne', error: null },
    resoudre_anomalie_paiement: { data: true, error: null },
  });

Deno.test('SEPA rejeté consigné en etat_incoherent : rattrapé, puis résolu', async () => {
  const appels: Appel[] = [];
  const bilan = await retraiterAnomalies(
    appelantQuiListe([{ id: 'an-1', session_prestataire: 'cs_rejet', motif: 'etat_incoherent' }]),
    serveurQuiAbonne(appels),
    (id) => Promise.resolve(sessionSepaRejetee(id)),
    null,
  );
  deepStrictEqual(bilan, [
    {
      anomalie: 'an-1',
      session: 'cs_rejet',
      motif: 'etat_incoherent',
      issue: 'resolue',
      detail: 'abonne',
    },
  ] satisfies Bilan[]);
  deepStrictEqual(
    appels.map((a) => [a.fonction, a.arguments.p_moyen ?? a.arguments.p_id]),
    [
      ['synchroniser_session_paiement', 'sepa'],
      ['resoudre_anomalie_paiement', 'an-1'],
    ],
  );
});

Deno.test('moyen toujours illisible : reste ouverte, jamais résolue', async () => {
  const appels: Appel[] = [];
  const bilan = await retraiterAnomalies(
    appelantQuiListe([{ id: 'an-2', session_prestataire: 'cs_vide', motif: 'etat_incoherent' }]),
    serveurQuiAbonne(appels),
    (id) => Promise.resolve(sessionIllisible(id)),
    null,
  );
  deepStrictEqual(
    bilan.map((b) => [b.issue, b.detail]),
    [['ouverte', 'incoherence:moyen_indetermine']],
  );
  deepStrictEqual(
    appels.map((a) => a.fonction),
    ['enregistrer_anomalie_paiement'],
  );
});

Deno.test('une relecture impossible n’arrête pas les suivantes', async () => {
  const appels: Appel[] = [];
  const bilan = await retraiterAnomalies(
    appelantQuiListe([
      { id: 'an-3', session_prestataire: 'cs_banc_inexistante', motif: 'etat_incoherent' },
      { id: 'an-4', session_prestataire: 'cs_rejet', motif: 'etat_incoherent' },
    ]),
    serveurQuiAbonne(appels),
    (id) =>
      id === 'cs_banc_inexistante'
        ? Promise.reject(new Error('No such checkout.session'))
        : Promise.resolve(sessionSepaRejetee(id)),
    null,
  );
  deepStrictEqual(
    bilan.map((b) => [b.anomalie, b.issue]),
    [
      ['an-3', 'ouverte'],
      ['an-4', 'resolue'],
    ],
  );
});

Deno.test('une session nommée : seules ses anomalies sont retraitées', async () => {
  const relues: string[] = [];
  const bilan = await retraiterAnomalies(
    appelantQuiListe([
      { id: 'an-5', session_prestataire: 'cs_autre', motif: 'etat_incoherent' },
      { id: 'an-6', session_prestataire: 'cs_rejet', motif: 'etat_incoherent' },
    ]),
    serveurQuiAbonne([]),
    (id) => {
      relues.push(id);
      return Promise.resolve(sessionSepaRejetee(id));
    },
    'cs_rejet',
  );
  deepStrictEqual(relues, ['cs_rejet']);
  deepStrictEqual(
    bilan.map((b) => b.anomalie),
    ['an-6'],
  );
});

Deno.test('un appelant qui n’est pas le serveur : refusé par Postgres, rien de relu', async () => {
  const relues: string[] = [];
  const appelant = faux([], {
    anomalies_paiement_ouvertes: {
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for function anomalies_paiement_ouvertes',
      },
    },
  });
  await rejects(
    retraiterAnomalies(
      appelant,
      serveurQuiAbonne([]),
      (id) => {
        relues.push(id);
        return Promise.resolve(sessionSepaRejetee(id));
      },
      null,
    ),
    RefusAppelant,
  );
  deepStrictEqual(relues, []);
});
