// Le changement de moyen de paiement (étape serveur de L4). Faux client Postgres : ce qui est
// prouvé ici, c'est la lecture de la session (quel moyen, quels chiffres, quel abonnement) et la
// décision prise pour chaque état ; la preuve contre la vraie base est au banc
// (remplacer_moyen_paiement, 0060/0061), contre le vrai Stripe la clôture de l'écran 20.
import { deepStrictEqual, rejects } from 'node:assert';
import { abonnementDeLaSession, appliquerNouveauMoyen, moyenDeLaSession } from './nouveau-moyen.ts';
import { type ClientPostgres } from './postgres.ts';
import { ErreurPassagere } from './session-paiement.ts';
import { type Stripe } from './stripe.ts';

type Appel = { fonction: string; arguments: Record<string, unknown> };
const ABONNEMENT = '6841f036-237a-48ba-b116-8569998b715c';

function fauxServeur(
  appels: Appel[],
  reponse: { data: unknown; error: { message: string; code: string } | null } = {
    data: '2026-12-02',
    error: null,
  },
): ClientPostgres {
  const faux = {
    rpc: (fonction: string, args: Record<string, unknown>) => {
      appels.push({ fonction, arguments: args });
      return Promise.resolve(reponse);
    },
  };
  return faux as unknown as ClientPostgres;
}

const session = (champs: Record<string, unknown>): Stripe.Checkout.Session =>
  ({
    id: 'cs_test_setup',
    mode: 'setup',
    status: 'complete',
    metadata: { abonnement_id: ABONNEMENT, usage: 'nouveau_moyen' },
    setup_intent: {
      id: 'seti_1',
      payment_method: {
        id: 'pm_nouveau',
        type: 'card',
        card: { last4: '4242' },
      },
    },
    ...champs,
  }) as unknown as Stripe.Checkout.Session;

Deno.test('carte enregistrée : identifiant, type carte, quatre derniers chiffres', () => {
  deepStrictEqual(moyenDeLaSession(session({})), {
    id: 'pm_nouveau',
    type: 'carte',
    derniersChiffres: '4242',
  });
});

Deno.test('prélèvement SEPA enregistré : type sepa, chiffres de l’IBAN', () => {
  const s = session({
    setup_intent: {
      payment_method: {
        id: 'pm_iban',
        type: 'sepa_debit',
        sepa_debit: { last4: '2606' },
      },
    },
  });
  deepStrictEqual(moyenDeLaSession(s), {
    id: 'pm_iban',
    type: 'sepa',
    derniersChiffres: '2606',
  });
});

Deno.test('moyen non développé, absent, ou d’un type que la page ne propose pas : null', () => {
  deepStrictEqual(moyenDeLaSession(session({ setup_intent: 'seti_1' })), null);
  deepStrictEqual(moyenDeLaSession(session({ setup_intent: { payment_method: null } })), null);
  deepStrictEqual(
    moyenDeLaSession(
      session({
        setup_intent: { payment_method: { id: 'pm_x', type: 'link' } },
      }),
    ),
    null,
  );
});

Deno.test('l’abonnement vient des métadonnées posées par le serveur, avec leur usage', () => {
  deepStrictEqual(abonnementDeLaSession(session({})), ABONNEMENT);
  deepStrictEqual(
    abonnementDeLaSession(session({ metadata: { abonnement_id: ABONNEMENT } })),
    null,
  );
  deepStrictEqual(
    abonnementDeLaSession(
      session({
        metadata: { abonnement_id: 'pas-un-uuid', usage: 'nouveau_moyen' },
      }),
    ),
    null,
  );
});

Deno.test(
  'session terminée : remplacer_moyen_paiement reçoit le moyen, le type et les chiffres ; la relance revient',
  async () => {
    const appels: Appel[] = [];
    const resultat = await appliquerNouveauMoyen(fauxServeur(appels), session({}));
    deepStrictEqual(resultat, {
      type: 'enregistre',
      prochaineTentativeLe: '2026-12-02',
    });
    deepStrictEqual(appels, [
      {
        fonction: 'remplacer_moyen_paiement',
        arguments: {
          p_abonnement_id: ABONNEMENT,
          p_moyen_prestataire: 'pm_nouveau',
          p_type: 'carte',
          p_derniers_chiffres: '4242',
        },
      },
    ]);
  },
);

Deno.test(
  'session ouverte, expirée, d’un autre usage, ou sans moyen lisible : rien d’écrit',
  async () => {
    for (const [s, attendu] of [
      [session({ status: 'open' }), { type: 'non_terminee' }],
      [session({ status: 'expired' }), { type: 'expiree' }],
      [session({ mode: 'payment' }), { type: 'ignoree' }],
      [session({ metadata: {} }), { type: 'ignoree' }],
      [
        session({ setup_intent: { payment_method: null } }),
        {
          type: 'moyen_illisible',
        },
      ],
    ] as const) {
      const appels: Appel[] = [];
      deepStrictEqual(await appliquerNouveauMoyen(fauxServeur(appels), s), attendu);
      deepStrictEqual(appels, []);
    }
  },
);

Deno.test('la base refuse : erreur passagère, jamais un succès inventé', async () => {
  const appels: Appel[] = [];
  const serveur = fauxServeur(appels, {
    data: null,
    error: { message: 'abonnement_introuvable', code: 'P0001' },
  });
  await rejects(() => appliquerNouveauMoyen(serveur, session({})), ErreurPassagere);
});
