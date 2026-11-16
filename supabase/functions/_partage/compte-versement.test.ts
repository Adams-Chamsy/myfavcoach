// L'identification du coach côté fonction (L5, P5.2) : l'état du compte de versement depuis les
// capacités du prestataire (docs/domaine.md §3.3), la relecture, la création du compte une seule
// fois, et la traduction des refus. Faux prestataire, faux clients Postgres.
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import {
  type CapacitesCompte,
  creerLienIdentification,
  enregistrerIdentiteFiscale,
  etatDepuisCapacites,
  lireIdentification,
  lireSaisieIdentiteFiscale,
  type PrestataireComptes,
} from './compte-versement.ts';
import { type ClientPostgres } from './postgres.ts';
import { TEXTES_REFUS } from './refus.ts';
import { ErreurPassagere } from './session-paiement.ts';

const PROFIL = '6841f036-237a-48ba-b116-8569998b715c';
const ACTIVE = { statut: 'active', aFournir: false } as const;
const A_FOURNIR = { statut: 'restricted', aFournir: true } as const;
const FERMEE = { statut: 'restricted', aFournir: false } as const;
const EN_COURS = { statut: 'pending', aFournir: false } as const;

type Appel = { fonction: string; args: Record<string, unknown> };

function client(
  reponses: Record<string, { data: unknown; error: unknown }>,
  journal: Appel[] = [],
) {
  return {
    rpc: (fonction: string, args: Record<string, unknown>) => {
      journal.push({ fonction, args });
      return Promise.resolve(
        reponses[fonction] ?? { data: null, error: { message: 'inattendue' } },
      );
    },
  } as unknown as ClientPostgres;
}

const identification = (compte: string, complete: boolean) => ({
  mon_identification: {
    data: [
      { profil_coach_id: PROFIL, compte_versement: compte, identite_fiscale_complete: complete },
    ],
    error: null,
  },
});

function prestataire(capacites: CapacitesCompte, journal: string[] = []): PrestataireComptes {
  return {
    creerCompte: (coach, cle) => {
      journal.push(`creer:${coach.profilCoachId}:${coach.email}:${coach.nomAffiche}:${cle}`);
      return Promise.resolve('acct_cree');
    },
    lireCapacites: (reference) => {
      journal.push(`lire:${reference}`);
      return Promise.resolve(capacites);
    },
    creerLienInscription: (reference, retour, reprise) => {
      journal.push(`lien:${reference}:${retour}:${reprise}`);
      return Promise.resolve('https://inscription.exemple/page');
    },
  };
}

Deno.test('état : opérationnel seulement si le compte peut recevoir ET virer à la banque', () => {
  strictEqual(etatDepuisCapacites({ transferts: ACTIVE, virements: ACTIVE }), 'operationnel');
  // L'un sans l'autre ne suffit pas (docs/domaine.md §3.3).
  strictEqual(etatDepuisCapacites({ transferts: ACTIVE, virements: EN_COURS }), 'en_verification');
  strictEqual(etatDepuisCapacites({ transferts: ACTIVE, virements: A_FOURNIR }), 'a_completer');
  strictEqual(etatDepuisCapacites({ transferts: ACTIVE, virements: FERMEE }), 'restreint');
});

Deno.test('état : à compléter, en vérification, restreint', () => {
  strictEqual(etatDepuisCapacites({ transferts: A_FOURNIR, virements: A_FOURNIR }), 'a_completer');
  strictEqual(etatDepuisCapacites({ transferts: null, virements: null }), 'a_completer');
  strictEqual(
    etatDepuisCapacites({ transferts: EN_COURS, virements: EN_COURS }),
    'en_verification',
  );
  strictEqual(etatDepuisCapacites({ transferts: FERMEE, virements: FERMEE }), 'restreint');
  strictEqual(
    etatDepuisCapacites({
      transferts: { statut: 'unsupported', aFournir: false },
      virements: ACTIVE,
    }),
    'restreint',
  );
  // Une information à fournir l'emporte sur un blocage : c'est ce que le coach peut faire.
  strictEqual(etatDepuisCapacites({ transferts: A_FOURNIR, virements: FERMEE }), 'a_completer');
});

Deno.test('lecture : sans compte, « absent », et le prestataire n’est pas interrogé', async () => {
  const appels: string[] = [];
  const reponse = await lireIdentification(
    client(identification('absent', false)),
    client({ compte_versement_serveur: { data: [], error: null } }),
    prestataire({ transferts: ACTIVE, virements: ACTIVE }, appels),
  );
  strictEqual(reponse.status, 200);
  deepStrictEqual(await reponse.json(), {
    compteVersement: 'absent',
    identiteFiscaleComplete: false,
    peutPublier: false,
  });
  deepStrictEqual(appels, []);
});

Deno.test(
  'lecture : l’état est RELU chez le prestataire et posé en base, pas celui gardé',
  async () => {
    const journal: Appel[] = [];
    const reponse = await lireIdentification(
      // La base croit encore « à compléter ».
      client(identification('a_completer', true)),
      client(
        {
          compte_versement_serveur: {
            data: [{ reference_compte_prestataire: 'acct_reel', etat: 'a_completer' }],
            error: null,
          },
          poser_etat_compte_versement: { data: null, error: null },
        },
        journal,
      ),
      prestataire({ transferts: ACTIVE, virements: ACTIVE }),
    );
    deepStrictEqual(await reponse.json(), {
      compteVersement: 'operationnel',
      identiteFiscaleComplete: true,
      peutPublier: true,
    });
    deepStrictEqual(journal[1], {
      fonction: 'poser_etat_compte_versement',
      args: { p_profil_coach_id: PROFIL, p_etat: 'operationnel' },
    });
  },
);

Deno.test(
  'lecture : opérationnel sans identité fiscale complète ne permet pas de publier',
  async () => {
    const reponse = await lireIdentification(
      client(identification('operationnel', false)),
      client({
        compte_versement_serveur: {
          data: [{ reference_compte_prestataire: 'acct_reel', etat: 'operationnel' }],
          error: null,
        },
        poser_etat_compte_versement: { data: null, error: null },
      }),
      prestataire({ transferts: ACTIVE, virements: ACTIVE }),
    );
    strictEqual(((await reponse.json()) as { peutPublier: boolean }).peutPublier, false);
  },
);

Deno.test('la référence du compte ne sort jamais vers l’application', async () => {
  const reponse = await lireIdentification(
    client(identification('a_completer', false)),
    client({
      compte_versement_serveur: {
        data: [{ reference_compte_prestataire: 'acct_secret', etat: 'a_completer' }],
        error: null,
      },
      poser_etat_compte_versement: { data: null, error: null },
    }),
    prestataire({ transferts: A_FOURNIR, virements: A_FOURNIR }),
  );
  strictEqual((await reponse.text()).includes('acct_secret'), false);
});

Deno.test(
  'un compte qui n’est pas en espace coach : 403 profil_coach_requis, avec son texte',
  async () => {
    const refus = { data: null, error: { code: 'P0001', message: 'profil_coach_requis' } };
    const reponse = await lireIdentification(
      client({ mon_identification: refus }),
      client({}),
      prestataire({ transferts: null, virements: null }),
    );
    strictEqual(reponse.status, 403);
    deepStrictEqual(await reponse.json(), {
      code: 'profil_coach_requis',
      title: TEXTES_REFUS.profil_coach_requis.title,
      detail: TEXTES_REFUS.profil_coach_requis.detail,
      status: 403,
    });
  },
);

Deno.test(
  'lien : premier appel, le compte est créé une fois (clé par coach), posé, puis le lien rendu',
  async () => {
    const appels: string[] = [];
    const journal: Appel[] = [];
    const reponse = await creerLienIdentification(
      client(identification('absent', false)),
      client(
        {
          compte_versement_serveur: { data: [], error: null },
          poser_compte_versement: { data: 'acct_cree', error: null },
        },
        journal,
      ),
      prestataire({ transferts: null, virements: null }, appels),
      () => Promise.resolve({ email: 'coach@exemple.fr', nomAffiche: 'Nadia Belkacem' }),
      {
        retour: 'https://app.exemple/?identification=retour',
        reprise: 'https://app.exemple/?identification=reprise',
      },
    );
    deepStrictEqual(await reponse.json(), { url: 'https://inscription.exemple/page' });
    deepStrictEqual(appels, [
      `creer:${PROFIL}:coach@exemple.fr:Nadia Belkacem:compte-versement-${PROFIL}`,
      'lien:acct_cree:https://app.exemple/?identification=retour:https://app.exemple/?identification=reprise',
    ]);
    deepStrictEqual(journal[1], {
      fonction: 'poser_compte_versement',
      args: { p_profil_coach_id: PROFIL, p_reference: 'acct_cree' },
    });
  },
);

Deno.test('lien : le compte existe déjà, aucun second compte n’est créé', async () => {
  const appels: string[] = [];
  await creerLienIdentification(
    client(identification('a_completer', false)),
    client({
      compte_versement_serveur: {
        data: [{ reference_compte_prestataire: 'acct_existant', etat: 'a_completer' }],
        error: null,
      },
    }),
    prestataire({ transferts: null, virements: null }, appels),
    () => Promise.resolve({ email: null, nomAffiche: 'Coach' }),
    { retour: 'r', reprise: 'p' },
  );
  deepStrictEqual(appels, ['lien:acct_existant:r:p']);
});

Deno.test(
  'lien : doublé par un appel concurrent, c’est la référence GARDÉE par la base qui sert',
  async () => {
    const appels: string[] = [];
    await creerLienIdentification(
      client(identification('absent', false)),
      client({
        compte_versement_serveur: { data: [], error: null },
        // La base a gardé le compte de l'autre appel.
        poser_compte_versement: { data: 'acct_du_premier', error: null },
      }),
      prestataire({ transferts: null, virements: null }, appels),
      () => Promise.resolve({ email: null, nomAffiche: 'Coach' }),
      { retour: 'r', reprise: 'p' },
    );
    strictEqual(appels[1], 'lien:acct_du_premier:r:p');
  },
);

Deno.test('identité fiscale : la forme du corps, les règles restant à la base', () => {
  const corps = {
    siren: '732829320',
    adresseLigne: '12 rue des Lilas',
    codePostal: '69003',
    commune: 'Lyon',
    regimeTva: 'franchise_en_base',
  };
  deepStrictEqual(lireSaisieIdentiteFiscale(corps), { ...corps, tauxTvaPourMille: null });
  for (const faux of [
    null,
    { ...corps, siren: 732829320 },
    { ...corps, regimeTva: 'autre' },
    { ...corps, tauxTvaPourMille: '200' },
    { ...corps, tauxTvaPourMille: 19.6 },
    { siren: '732829320' },
  ]) {
    strictEqual(lireSaisieIdentiteFiscale(faux), null, JSON.stringify(faux));
  }
  // Un SIREN à la clé fausse passe la forme : c'est 0070 qui le refuse, avec son texte.
  strictEqual(lireSaisieIdentiteFiscale({ ...corps, siren: '732829321' })?.siren, '732829321');
});

Deno.test('identité fiscale : acceptée, refusée avec son texte, ou erreur passagère', async () => {
  const saisie = {
    siren: '732829320',
    adresseLigne: '12 rue des Lilas',
    codePostal: '69003',
    commune: 'Lyon',
    regimeTva: 'assujetti' as const,
    tauxTvaPourMille: 200,
  };
  const journal: Appel[] = [];
  const acceptee = await enregistrerIdentiteFiscale(
    client({ enregistrer_identite_fiscale: { data: null, error: null } }, journal),
    saisie,
  );
  deepStrictEqual(await acceptee.json(), { enregistree: true });
  deepStrictEqual(journal[0].args, {
    p_siren: '732829320',
    p_adresse_ligne: '12 rue des Lilas',
    p_code_postal: '69003',
    p_commune: 'Lyon',
    p_regime_tva: 'assujetti',
    p_taux_tva_pour_mille: 200,
  });

  const refusee = await enregistrerIdentiteFiscale(
    client({
      enregistrer_identite_fiscale: {
        data: null,
        error: { code: 'P0001', message: 'identite_fiscale_invalide' },
      },
    }),
    saisie,
  );
  strictEqual(refusee.status, 422);
  strictEqual(
    ((await refusee.json()) as { title: string }).title,
    TEXTES_REFUS.identite_fiscale_invalide.title,
  );

  await rejects(
    () =>
      enregistrerIdentiteFiscale(
        client({ enregistrer_identite_fiscale: { data: null, error: { message: 'réseau' } } }),
        saisie,
      ),
    ErreurPassagere,
  );
});
