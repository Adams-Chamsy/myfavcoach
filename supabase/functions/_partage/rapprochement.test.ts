// Le rapprochement quotidien (P4.11a, docs/prompts/L4.md point 12) : les trois classes d'écart,
// dans les deux sens, et ce qu'il ne fait jamais. Faux prestataire, faux client Postgres.
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { type ClientPostgres } from './postgres.ts';
import {
  decalerJour,
  type Encaissement,
  executerRapprochement,
  LECTURES_MAX,
  TAILLE_PAGE,
  type PrestataireRapprochement,
} from './rapprochement.ts';
import { ErreurPassagere } from './session-paiement.ts';

type Facture = { reference_prestataire: string; montant_ttc_centimes: number };

// La base du faux : toutes les factures connues, et celles payées sur la fenêtre.
function fauxServeur(
  toutes: Facture[],
  fenetre: Facture[],
  journal: { fonction: string; args: Record<string, unknown> }[] = [],
  dejaConnus: string[] = [],
) {
  return {
    rpc: (fonction: string, args: Record<string, unknown>) => {
      journal.push({ fonction, args });
      if (fonction === 'factures_par_reference') {
        const voulues = args.p_references as string[];
        return Promise.resolve({
          data: toutes.filter((f) => voulues.includes(f.reference_prestataire)),
          error: null,
        });
      }
      if (fonction === 'factures_payees_entre') {
        // Comme l'API réelle : jamais plus d'une page par appel, la page demandée par range().
        return {
          range: (debut: number, fin: number) => {
            journal.push({ fonction: 'range', args: { debut, fin } });
            return Promise.resolve({ data: fenetre.slice(debut, fin + 1), error: null });
          },
        };
      }
      if (fonction === 'enregistrer_ecart_rapprochement') {
        return Promise.resolve({
          data: !dejaConnus.includes(args.p_reference as string),
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `inattendue : ${fonction}` } });
    },
  } as unknown as ClientPostgres;
}

function fauxPrestataire(
  encaissements: Encaissement[],
  parReference: Record<string, number | null> = {},
  lectures: string[] = [],
  bornes: number[] = [],
): PrestataireRapprochement {
  return {
    listerEncaissements: (depuis, jusqua) => {
      bornes.push(depuis, jusqua);
      return Promise.resolve(encaissements);
    },
    lireEncaissement: (reference) => {
      lectures.push(reference);
      return Promise.resolve(parReference[reference] ?? null);
    },
  };
}

const ecrits = (journal: { fonction: string; args: Record<string, unknown> }[]) =>
  journal.filter((a) => a.fonction === 'enregistrer_ecart_rapprochement').map((a) => a.args);

Deno.test('tout correspond : aucun écart, rien d’écrit', async () => {
  const journal: { fonction: string; args: Record<string, unknown> }[] = [];
  const souscription = { reference_prestataire: 'cs_test_a1', montant_ttc_centimes: 4900 };
  const echeance = { reference_prestataire: 'pi_3Qb2', montant_ttc_centimes: 4900 };
  const bilan = await executerRapprochement(
    fauxServeur([souscription, echeance], [souscription, echeance], journal),
    fauxPrestataire([
      { reference: 'cs_test_a1', montantCentimes: 4900 },
      { reference: 'pi_3Qb2', montantCentimes: 4900 },
    ]),
    '2026-11-12',
    '2026-11-14',
  );
  deepStrictEqual(bilan.ecarts, []);
  strictEqual(bilan.encaissements, 2);
  strictEqual(bilan.factures, 2);
  strictEqual(bilan.nouveaux, 0);
  deepStrictEqual(ecrits(journal), []);
});

Deno.test(
  'encaissé sans facture : un paiement réussi qu’aucune facture ne porte (l’événement perdu)',
  async () => {
    const journal: { fonction: string; args: Record<string, unknown> }[] = [];
    const bilan = await executerRapprochement(
      fauxServeur([], [], journal),
      fauxPrestataire([{ reference: 'pi_3Perdu', montantCentimes: 4900 }]),
      '2026-11-12',
      '2026-11-14',
    );
    deepStrictEqual(bilan.ecarts, [
      {
        classe: 'encaisse_sans_facture',
        reference: 'pi_3Perdu',
        montantPrestataireCentimes: 4900,
        montantFactureCentimes: null,
      },
    ]);
    strictEqual(bilan.nouveaux, 1);
    deepStrictEqual(ecrits(journal), [
      {
        p_classe: 'encaisse_sans_facture',
        p_reference: 'pi_3Perdu',
        p_montant_prestataire: 4900,
        p_montant_facture: null,
      },
    ]);
  },
);

Deno.test(
  'facture sans encaissement : la référence n’existe pas, ou pas comme réussie, chez le prestataire',
  async () => {
    const lectures: string[] = [];
    const inconnue = { reference_prestataire: 'pi_3Inconnue', montant_ttc_centimes: 4900 };
    const bilan = await executerRapprochement(
      fauxServeur([inconnue], [inconnue]),
      fauxPrestataire([], { pi_3Inconnue: null }, lectures),
      '2026-11-12',
      '2026-11-14',
    );
    deepStrictEqual(bilan.ecarts, [
      {
        classe: 'facture_sans_encaissement',
        reference: 'pi_3Inconnue',
        montantPrestataireCentimes: null,
        montantFactureCentimes: 4900,
      },
    ]);
    deepStrictEqual(lectures, ['pi_3Inconnue']);
  },
);

Deno.test('montant différent : dans les deux sens de recherche', async () => {
  const listee = { reference_prestataire: 'cs_test_a1', montant_ttc_centimes: 4900 };
  const lue = { reference_prestataire: 'pi_3Vieille', montant_ttc_centimes: 4900 };
  const bilan = await executerRapprochement(
    fauxServeur([listee, lue], [listee, lue]),
    // La première est dans la liste de la fenêtre ; la seconde, créée avant, est lue à l'unité.
    fauxPrestataire([{ reference: 'cs_test_a1', montantCentimes: 3900 }], { pi_3Vieille: 2000 }),
    '2026-11-12',
    '2026-11-14',
  );
  deepStrictEqual(bilan.ecarts, [
    {
      classe: 'montant_different',
      reference: 'cs_test_a1',
      montantPrestataireCentimes: 3900,
      montantFactureCentimes: 4900,
    },
    {
      classe: 'montant_different',
      reference: 'pi_3Vieille',
      montantPrestataireCentimes: 2000,
      montantFactureCentimes: 4900,
    },
  ]);
});

Deno.test(
  'une facture payée sur la fenêtre mais née avant (SEPA) est lue à l’unité : pas un faux écart',
  async () => {
    const lectures: string[] = [];
    const sepa = { reference_prestataire: 'pi_3Sepa', montant_ttc_centimes: 4900 };
    const bilan = await executerRapprochement(
      fauxServeur([sepa], [sepa]),
      fauxPrestataire([], { pi_3Sepa: 4900 }, lectures),
      '2026-11-12',
      '2026-11-14',
    );
    deepStrictEqual(bilan.ecarts, []);
    deepStrictEqual(lectures, ['pi_3Sepa']);
  },
);

Deno.test(
  'une référence que le prestataire n’a pas pu émettre (banc) : écart, sans le lui demander',
  async () => {
    const lectures: string[] = [];
    const banc = [
      { reference_prestataire: 'cs_banc_1794_a', montant_ttc_centimes: 4900 },
      { reference_prestataire: 'pi_banc_1794_b', montant_ttc_centimes: 4900 },
      { reference_prestataire: 'banc-1794-c', montant_ttc_centimes: 4900 },
    ];
    const bilan = await executerRapprochement(
      fauxServeur(banc, banc),
      fauxPrestataire([], {}, lectures),
      '2026-11-12',
      '2026-11-14',
    );
    deepStrictEqual(
      bilan.ecarts.map((e) => e.classe),
      ['facture_sans_encaissement', 'facture_sans_encaissement', 'facture_sans_encaissement'],
    );
    deepStrictEqual(lectures, []);
  },
);

Deno.test('un écart déjà connu n’est pas compté comme nouveau', async () => {
  const bilan = await executerRapprochement(
    fauxServeur([], [], [], ['pi_3Perdu']),
    fauxPrestataire([
      { reference: 'pi_3Perdu', montantCentimes: 4900 },
      { reference: 'pi_3Autre', montantCentimes: 4900 },
    ]),
    '2026-11-12',
    '2026-11-14',
  );
  strictEqual(bilan.ecarts.length, 2);
  strictEqual(bilan.nouveaux, 1);
});

Deno.test('plafond de lectures : les factures au-delà sont comptées, jamais devinées', async () => {
  const lectures: string[] = [];
  const factures = Array.from({ length: LECTURES_MAX + 3 }, (_, i) => ({
    reference_prestataire: `pi_3F${i}`,
    montant_ttc_centimes: 4900,
  }));
  const parReference = Object.fromEntries(factures.map((f) => [f.reference_prestataire, 4900]));
  const bilan = await executerRapprochement(
    fauxServeur(factures, factures),
    fauxPrestataire([], parReference, lectures),
    '2026-11-12',
    '2026-11-14',
  );
  strictEqual(lectures.length, LECTURES_MAX);
  strictEqual(bilan.nonVerifiees, 3);
  deepStrictEqual(bilan.ecarts, []);
});

Deno.test(
  'plus d’une page de factures : toutes sont lues, aucune n’est perdue en silence',
  async () => {
    const journal: { fonction: string; args: Record<string, unknown> }[] = [];
    const factures = Array.from({ length: TAILLE_PAGE + 2 }, (_, i) => ({
      reference_prestataire: `banc-${i}`,
      montant_ttc_centimes: 4900,
    }));
    const bilan = await executerRapprochement(
      fauxServeur(factures, factures, journal),
      fauxPrestataire([]),
      '2026-11-12',
      '2026-11-14',
    );
    strictEqual(bilan.factures, TAILLE_PAGE + 2);
    strictEqual(bilan.ecarts.length, TAILLE_PAGE + 2);
    deepStrictEqual(
      journal.filter((a) => a.fonction === 'range').map((a) => a.args),
      [
        { debut: 0, fin: TAILLE_PAGE - 1 },
        { debut: TAILLE_PAGE, fin: 2 * TAILLE_PAGE - 1 },
      ],
    );
  },
);

Deno.test(
  'il signale, il ne corrige jamais : seules des lectures et l’écriture d’écarts',
  async () => {
    const journal: { fonction: string; args: Record<string, unknown> }[] = [];
    await executerRapprochement(
      fauxServeur([], [{ reference_prestataire: 'pi_3X', montant_ttc_centimes: 100 }], journal),
      fauxPrestataire([{ reference: 'pi_3Y', montantCentimes: 100 }]),
      '2026-11-12',
      '2026-11-14',
    );
    deepStrictEqual([...new Set(journal.map((a) => a.fonction))].sort(), [
      'enregistrer_ecart_rapprochement',
      'factures_par_reference',
      'factures_payees_entre',
      'range',
    ]);
  },
);

Deno.test(
  'la fenêtre demandée au prestataire couvre les jours de Paris, bords élargis',
  async () => {
    const bornes: number[] = [];
    await executerRapprochement(
      fauxServeur([], []),
      fauxPrestataire([], {}, [], bornes),
      '2026-11-12',
      '2026-11-14',
    );
    // Du 11 novembre 22:00 UTC au 15 novembre 02:00 UTC.
    deepStrictEqual(bornes, [
      Date.parse('2026-11-11T22:00:00Z') / 1000,
      Date.parse('2026-11-15T02:00:00Z') / 1000,
    ]);
  },
);

Deno.test(
  'une lecture de la base en échec n’est pas « aucun écart » : erreur passagère',
  async () => {
    const enPanne = {
      rpc: () =>
        Object.assign(Promise.resolve({ data: null, error: { message: 'panne' } }), {
          range: () => Promise.resolve({ data: null, error: { message: 'panne' } }),
        }),
    } as unknown as ClientPostgres;
    await rejects(
      () => executerRapprochement(enPanne, fauxPrestataire([]), '2026-11-12', '2026-11-14'),
      ErreurPassagere,
    );
  },
);

Deno.test('decalerJour : calcul de calendrier, fin de mois et d’année comprises', () => {
  strictEqual(decalerJour('2026-11-15', -3), '2026-11-12');
  strictEqual(decalerJour('2026-03-01', -1), '2026-02-28');
  strictEqual(decalerJour('2026-12-31', 1), '2027-01-01');
});
