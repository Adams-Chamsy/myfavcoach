// Le prélèvement d'une échéance hors session (P4.8b ; docs/domaine.md §4.4, docs/backend.md
// « Pas de Stripe Billing »). Faux client Postgres et faux prestataire : ce qui est prouvé ici,
// c'est l'enchaînement — quelle tentative s'ouvre, avec quelle référence, et quelle issue la
// conclut. La preuve contre le vrai Stripe est l'essai de P4.8b (docs/prompts/L4.md).
import { deepStrictEqual, strictEqual } from 'node:assert';
import { type ClientPostgres } from './postgres.ts';
import {
  conclureDepuisPaiement,
  type Echeance,
  motifDuRefus,
  type PaiementPrestataire,
  executerJournee,
  preleverEcheance,
  type Prestataire,
} from './prelevement.ts';

type Appel = { fonction: string; arguments: Record<string, unknown> };

const DUE: Echeance = {
  abonnement_id: 'abo-1',
  echeance_le: '2026-12-01',
  tentative_numero: 1,
  montant_centimes: 4900,
};

// Le faux client : `from('abonnements')` rend les références conservées ; `rpc` note les appels.
function fauxServeur(
  appels: Appel[],
  abonnement: Record<string, unknown> | null = {
    reference_client_prestataire: 'cus_1',
    reference_moyen_prestataire: 'pm_1',
    moyen: 'carte',
  },
  erreurs: Record<string, { message: string; code: string }> = {},
): ClientPostgres {
  return {
    rpc: (fonction: string, args: Record<string, unknown>) => {
      appels.push({ fonction, arguments: args });
      const erreur = erreurs[fonction];
      return Promise.resolve({ data: erreur ? null : 'ok', error: erreur ?? null });
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: abonnement, error: null }),
        }),
      }),
    }),
  } as unknown as ClientPostgres;
}

function fauxPrestataire(
  reponse: PaiementPrestataire | Error,
  demandes: { cle: string; demande: unknown }[] = [],
): Prestataire {
  return {
    creerPaiement: (demande, cle) => {
      demandes.push({ cle, demande });
      return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse);
    },
  };
}

const resume = (appels: Appel[]) =>
  appels.map((a) => [
    a.fonction,
    a.arguments.p_reference,
    a.arguments.p_reussie,
    a.arguments.p_motif,
  ]);

// --- La traduction des refus, validée le 1er novembre 2026 (docs/prompts/L4.md, P4.8) ---

Deno.test('motifs : la table validée, et jamais deviné', () => {
  const cas: [string | null, string][] = [
    ['insufficient_funds', 'fonds_insuffisants'],
    ['expired_card', 'carte_expiree'],
    ['lost_card', 'opposition'],
    ['stolen_card', 'opposition'],
    ['pickup_card', 'opposition'],
    ['debit_not_authorized', 'opposition'],
    ['card_velocity_exceeded', 'plafond_atteint'],
    ['withdrawal_count_limit_exceeded', 'plafond_atteint'],
    ['authentication_required', 'authentification_echouee'],
    ['generic_decline', 'inconnu'],
    ['code_que_personne_ne_connait', 'inconnu'],
    [null, 'inconnu'],
  ];
  for (const [code, motif] of cas) strictEqual(motifDuRefus(code), motif, String(code));
});

// --- preleverEcheance ---

Deno.test(
  'carte acceptée : tentative ouverte puis conclue réussie, sous la référence du paiement',
  async () => {
    const appels: Appel[] = [];
    const demandes: { cle: string; demande: unknown }[] = [];
    const issue = await preleverEcheance(
      fauxServeur(appels),
      fauxPrestataire({ id: 'pi_ok', statut: 'succeeded', codeRefus: null }, demandes),
      DUE,
      '2026-12-01',
    );
    deepStrictEqual(issue, {
      abonnement: 'abo-1',
      echeance: '2026-12-01',
      numero: 1,
      issue: 'reussie',
      detail: null,
    });
    deepStrictEqual(resume(appels), [
      ['ouvrir_tentative', 'pi_ok', undefined, undefined],
      ['conclure_tentative', 'pi_ok', true, null],
    ]);
    // Une clé par tentative : un nouvel essai de la même tentative rend le même paiement chez
    // Stripe, jamais un second prélèvement.
    strictEqual(demandes[0].cle, 'echeance-abo-1-2026-12-01-1');
    deepStrictEqual(demandes[0].demande, {
      montantCentimes: 4900,
      client: 'cus_1',
      moyen: 'pm_1',
      type: 'carte',
      metadonnees: { abonnement_id: 'abo-1', echeance_le: '2026-12-01', tentative_numero: '1' },
    });
  },
);

Deno.test('carte refusée : tentative ouverte puis conclue en échec, motif traduit', async () => {
  const appels: Appel[] = [];
  const issue = await preleverEcheance(
    fauxServeur(appels),
    fauxPrestataire({
      id: 'pi_ko',
      statut: 'requires_payment_method',
      codeRefus: 'insufficient_funds',
    }),
    DUE,
    '2026-12-01',
  );
  deepStrictEqual([issue.issue, issue.detail], ['echouee', 'fonds_insuffisants']);
  deepStrictEqual(resume(appels), [
    ['ouvrir_tentative', 'pi_ko', undefined, undefined],
    ['conclure_tentative', 'pi_ko', false, 'fonds_insuffisants'],
  ]);
});

Deno.test('SEPA en traitement : tentative ouverte, conclue plus tard par le webhook', async () => {
  const appels: Appel[] = [];
  const issue = await preleverEcheance(
    fauxServeur(appels, {
      reference_client_prestataire: 'cus_1',
      reference_moyen_prestataire: 'pm_sepa',
      moyen: 'sepa',
    }),
    fauxPrestataire({ id: 'pi_sepa', statut: 'processing', codeRefus: null }),
    DUE,
    '2026-12-01',
  );
  strictEqual(issue.issue, 'en_cours');
  deepStrictEqual(resume(appels), [['ouvrir_tentative', 'pi_sepa', undefined, undefined]]);
});

Deno.test(
  'le prestataire ne répond pas : aucune tentative ouverte, l’échéance reste due',
  async () => {
    const appels: Appel[] = [];
    const issue = await preleverEcheance(
      fauxServeur(appels),
      fauxPrestataire(new Error('réseau')),
      DUE,
      '2026-12-01',
    );
    strictEqual(issue.issue, 'erreur');
    deepStrictEqual(appels, []);
  },
);

Deno.test(
  'aucun moyen conservé : la tentative échoue, motif inconnu, sans appeler le prestataire',
  async () => {
    const appels: Appel[] = [];
    const demandes: { cle: string; demande: unknown }[] = [];
    const issue = await preleverEcheance(
      fauxServeur(appels, {
        reference_client_prestataire: 'cus_1',
        reference_moyen_prestataire: null,
        moyen: 'carte',
      }),
      fauxPrestataire({ id: 'pi_inutile', statut: 'succeeded', codeRefus: null }, demandes),
      DUE,
      '2026-12-01',
    );
    deepStrictEqual([issue.issue, issue.detail], ['echouee', 'inconnu']);
    deepStrictEqual(demandes, []);
    deepStrictEqual(resume(appels), [
      ['ouvrir_tentative', 'sans-moyen-abo-1-2026-12-01-1', undefined, undefined],
      ['conclure_tentative', 'sans-moyen-abo-1-2026-12-01-1', false, 'inconnu'],
    ]);
  },
);

// --- conclureDepuisPaiement (webhook) ---

const METADONNEES = { abonnement_id: 'abo-1', echeance_le: '2026-12-01', tentative_numero: '1' };

Deno.test('webhook, paiement d’échéance réussi : tentative conclue réussie', async () => {
  const appels: Appel[] = [];
  const r = await conclureDepuisPaiement(fauxServeur(appels), {
    id: 'pi_sepa',
    statut: 'succeeded',
    codeRefus: null,
    metadonnees: METADONNEES,
  });
  strictEqual(r, 'conclue');
  deepStrictEqual(resume(appels), [['conclure_tentative', 'pi_sepa', true, null]]);
});

Deno.test(
  'webhook, paiement d’échéance rejeté : tentative conclue en échec, motif traduit',
  async () => {
    const appels: Appel[] = [];
    await conclureDepuisPaiement(fauxServeur(appels), {
      id: 'pi_sepa',
      statut: 'requires_payment_method',
      codeRefus: 'debit_not_authorized',
      metadonnees: METADONNEES,
    });
    deepStrictEqual(resume(appels), [['conclure_tentative', 'pi_sepa', false, 'opposition']]);
  },
);

Deno.test(
  'webhook, paiement sans métadonnées d’échéance (la page de paiement) : ignoré',
  async () => {
    const appels: Appel[] = [];
    const r = await conclureDepuisPaiement(fauxServeur(appels), {
      id: 'pi_checkout',
      statut: 'succeeded',
      codeRefus: null,
      metadonnees: {},
    });
    strictEqual(r, 'hors_echeance');
    deepStrictEqual(appels, []);
  },
);

Deno.test('webhook, paiement encore en traitement : rien à conclure', async () => {
  const appels: Appel[] = [];
  const r = await conclureDepuisPaiement(fauxServeur(appels), {
    id: 'pi_sepa',
    statut: 'processing',
    codeRefus: null,
    metadonnees: METADONNEES,
  });
  strictEqual(r, 'en_attente');
  deepStrictEqual(appels, []);
});

Deno.test(
  'webhook arrivé avant l’ouverture de la tentative : erreur passagère, relivré',
  async () => {
    let leve = false;
    try {
      await conclureDepuisPaiement(
        fauxServeur([], undefined, {
          conclure_tentative: { message: 'tentative_inconnue', code: 'P0001' },
        }),
        { id: 'pi_trop_tot', statut: 'succeeded', codeRefus: null, metadonnees: METADONNEES },
      );
    } catch {
      leve = true;
    }
    strictEqual(leve, true);
  },
);

// --- executerJournee (la tâche planifiée) ---

Deno.test(
  'la journée : transitions du calendrier D’ABORD, puis chaque échéance due, dans l’ordre',
  async () => {
    const appels: Appel[] = [];
    const serveur = {
      rpc: (fonction: string, args: Record<string, unknown>) => {
        appels.push({ fonction, arguments: args });
        if (fonction === 'appliquer_echeances') {
          return Promise.resolve({ data: { reprises: 1 }, error: null });
        }
        if (fonction === 'echeances_a_prelever') {
          return Promise.resolve({
            data: [DUE, { ...DUE, abonnement_id: 'abo-2' }],
            error: null,
          });
        }
        return Promise.resolve({ data: 'ok', error: null });
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  reference_client_prestataire: 'cus_1',
                  reference_moyen_prestataire: 'pm_1',
                  moyen: 'carte',
                },
                error: null,
              }),
          }),
        }),
      }),
    } as unknown as ClientPostgres;
    const bilan = await executerJournee(
      serveur,
      fauxPrestataire({ id: 'pi_x', statut: 'processing', codeRefus: null }),
      '2026-12-01',
    );
    deepStrictEqual(
      appels.map((a) => [
        a.fonction,
        a.fonction === 'ouvrir_tentative' ? a.arguments.p_abonnement_id : a.arguments.p_jour,
      ]),
      [
        ['appliquer_echeances', '2026-12-01'],
        ['echeances_a_prelever', '2026-12-01'],
        ['ouvrir_tentative', 'abo-1'],
        ['ouvrir_tentative', 'abo-2'],
      ],
    );
    deepStrictEqual(bilan.transitions, { reprises: 1 });
    deepStrictEqual(
      bilan.prelevements.map((p) => [p.abonnement, p.issue]),
      [
        ['abo-1', 'en_cours'],
        ['abo-2', 'en_cours'],
      ],
    );
  },
);
