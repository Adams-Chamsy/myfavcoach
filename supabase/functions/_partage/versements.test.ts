// Les versements côté fonction (L5, P5.4b) : chaque issue du prestataire et ce qu'elle écrit en
// base, la tâche du matin, la demande immédiate du coach. Faux prestataire, faux clients.
import { deepStrictEqual, strictEqual } from 'node:assert';
import { type ClientPostgres } from './postgres.ts';
import { TEXTES_REFUS } from './refus.ts';
import {
  demanderVersementImmediat,
  executerVersements,
  type IssueVirement,
  type PrestataireVersements,
} from './versements.ts';

type Appel = { fonction: string; args: Record<string, unknown> };

function client(
  reponses: Record<string, { data: unknown; error: unknown }>,
  journal: Appel[] = [],
) {
  return {
    rpc: (fonction: string, args: Record<string, unknown>) => {
      journal.push({ fonction, args });
      return Promise.resolve(reponses[fonction] ?? { data: null, error: null });
    },
  } as unknown as ClientPostgres;
}

function prestataire(
  issues: Record<string, IssueVirement | Error>,
  demandes: unknown[] = [],
): PrestataireVersements {
  return {
    virer: (demande) => {
      demandes.push(demande);
      const issue = issues[demande.versementId];
      return issue instanceof Error ? Promise.reject(issue) : Promise.resolve(issue);
    },
  };
}

const prevus = (ids: string[]) => ({
  data: ids.map((id) => ({
    versement_id: id,
    montant_centimes: 9310,
    reference_compte_prestataire: `acct_${id}`,
  })),
  error: null,
});

Deno.test(
  'tâche du matin : les versements du mois, puis chaque prévu ; versé, échoué, reporté, panne',
  async () => {
    const journal: Appel[] = [];
    const demandes: unknown[] = [];
    const bilan = await executerVersements(
      client(
        {
          creer_versements_mensuels: { data: 2, error: null },
          versements_a_executer: prevus(['v1', 'v2', 'v3', 'v4']),
        },
        journal,
      ),
      prestataire(
        {
          v1: { issue: 'accepte', reference: 'tr_1' },
          v2: { issue: 'refuse', motif: 'account_invalid' },
          v3: { issue: 'reporte', motif: 'balance_insufficient' },
          v4: new Error('réseau'),
        },
        demandes,
      ),
      '2026-12-05',
    );
    strictEqual(bilan.crees, 2);
    deepStrictEqual(
      bilan.versements.map((v) => [v.versement, v.issue, v.detail]),
      [
        ['v1', 'verse', null],
        ['v2', 'echoue', 'account_invalid'],
        ['v3', 'reporte', 'balance_insufficient'],
        ['v4', 'erreur', 'prestataire_injoignable'],
      ],
    );
    deepStrictEqual(journal[0], {
      fonction: 'creer_versements_mensuels',
      args: { p_jour: '2026-12-05' },
    });
    deepStrictEqual(demandes[0], { versementId: 'v1', montantCentimes: 9310, compte: 'acct_v1' });
    // Accepté : en cours avec la référence du virement, puis versé (décision 3).
    deepStrictEqual(
      journal.filter((a) => a.args.p_versement_id === 'v1').map((a) => [a.fonction, a.args]),
      [
        ['poser_versement_en_cours', { p_versement_id: 'v1', p_reference: 'tr_1' }],
        ['conclure_versement', { p_versement_id: 'v1', p_reussi: true }],
      ],
    );
    // Refusé : échoué, avec son motif ; son montant revient au solde (0073).
    deepStrictEqual(
      journal.filter((a) => a.args.p_versement_id === 'v2').map((a) => a.args),
      [{ p_versement_id: 'v2', p_reussi: false, p_motif: 'account_invalid' }],
    );
    // Reporté ou en panne : rien n'est écrit, le versement reste prévu pour le lendemain.
    strictEqual(
      journal.some((a) => a.args.p_versement_id === 'v3' || a.args.p_versement_id === 'v4'),
      false,
    );
  },
);

Deno.test(
  'demande immédiate : le versement part tout de suite, le coach lit son état réel',
  async () => {
    const demandes: unknown[] = [];
    const reponse = await demanderVersementImmediat(
      client({ demander_versement_immediat: { data: 'v9', error: null } }),
      client({ versements_a_executer: prevus(['v8', 'v9']) }),
      prestataire({ v9: { issue: 'accepte', reference: 'tr_9' } }, demandes),
    );
    strictEqual(reponse.status, 201);
    deepStrictEqual(await reponse.json(), { versementId: 'v9', statut: 'verse' });
    // Seul le versement demandé part, pas celui d'un autre coach en attente.
    deepStrictEqual(demandes, [{ versementId: 'v9', montantCentimes: 9310, compte: 'acct_v9' }]);
  },
);

Deno.test(
  'demande immédiate : fonds pas encore disponibles, le versement reste prévu',
  async () => {
    const reponse = await demanderVersementImmediat(
      client({ demander_versement_immediat: { data: 'v9', error: null } }),
      client({ versements_a_executer: prevus(['v9']) }),
      prestataire({ v9: { issue: 'reporte', motif: 'balance_insufficient' } }),
    );
    deepStrictEqual(await reponse.json(), { versementId: 'v9', statut: 'prevu' });
  },
);

for (const [code, statut] of [
  ['solde_insuffisant', 409],
  ['compte_versement_non_operationnel', 409],
  ['versement_deja_en_cours', 409],
  ['profil_coach_requis', 403],
] as const) {
  Deno.test(
    `demande immédiate refusée par la base (${code}) : ${statut}, avec son texte, rien ne part`,
    async () => {
      const demandes: unknown[] = [];
      const reponse = await demanderVersementImmediat(
        client({
          demander_versement_immediat: { data: null, error: { code: 'P0001', message: code } },
        }),
        client({}),
        prestataire({}, demandes),
      );
      strictEqual(reponse.status, statut);
      strictEqual(((await reponse.json()) as { title: string }).title, TEXTES_REFUS[code].title);
      deepStrictEqual(demandes, []);
    },
  );
}

Deno.test('demande immédiate sans compte (42501) : 401, pas une panne', async () => {
  const reponse = await demanderVersementImmediat(
    client({ demander_versement_immediat: { data: null, error: { code: '42501', message: 'x' } } }),
    client({}),
    prestataire({}),
  );
  strictEqual(reponse.status, 401);
});
