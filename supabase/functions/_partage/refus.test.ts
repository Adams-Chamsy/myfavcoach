// Les textes de refus (docs/api.md §1, règle du 31 octobre 2026) et la règle d'abonnement unique
// côté fonctions (P4.5d). Lancé par `npm run verif:fonctions` (deno test).
import { deepStrictEqual, strictEqual } from 'node:assert';
import { type ClientPostgres } from './postgres.ts';
import { corpsRefus, reponseRefus, STATUTS_REFUS_INTENTION, TEXTES_REFUS } from './refus.ts';
import { synchroniserSession } from './session-paiement.ts';
import { type Stripe } from './stripe.ts';

Deno.test('deja_abonne : refus 409 de l’intention, avec son texte', () => {
  strictEqual(STATUTS_REFUS_INTENTION.deja_abonne, 409);
  deepStrictEqual(corpsRefus(409, 'deja_abonne'), {
    code: 'deja_abonne',
    title: 'Tu as déjà un abonnement avec ce coach',
    detail: "Rien n'a été débité. Tu le retrouves dans ton compte, rubrique Mes abonnements.",
    status: 409,
  });
});

Deno.test('chaque refus de l’intention a son texte', () => {
  for (const code of Object.keys(STATUTS_REFUS_INTENTION)) {
    strictEqual(code in TEXTES_REFUS, true, code);
  }
});

Deno.test('un refus est un problem+json, avec les en-têtes CORS', async () => {
  const reponse = reponseRefus(404, 'intention_introuvable');
  strictEqual(reponse.status, 404);
  strictEqual(reponse.headers.get('Content-Type'), 'application/problem+json');
  strictEqual(reponse.headers.get('Access-Control-Allow-Origin'), '*');
  deepStrictEqual(await reponse.json(), corpsRefus(404, 'intention_introuvable'));
});

// « Jamais un code technique à l'écran » : aucun texte ne contient un mot à tiret bas.
Deno.test('aucun texte affichable ne contient un code technique', () => {
  for (const [code, { title, detail }] of Object.entries(TEXTES_REFUS)) {
    strictEqual(/\w_\w/.test(`${title} ${detail}`), false, code);
  }
});

Deno.test('abonnement_existant (0043) est un résultat reconnu de la synchronisation', async () => {
  const serveur = {
    rpc: () => Promise.resolve({ data: 'abonnement_existant', error: null }),
  } as unknown as ClientPostgres;
  const session = {
    id: 'cs_seconde',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 4900,
    customer: null,
    metadata: { intention_id: '6841f036-237a-48ba-b116-8569998b715c' },
    payment_intent: { status: 'succeeded', payment_method: { type: 'card' } },
  } as unknown as Stripe.Checkout.Session;
  deepStrictEqual(await synchroniserSession(serveur, session, null), {
    type: 'resultat',
    resultat: 'abonnement_existant',
  });
});
