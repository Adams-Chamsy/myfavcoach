// La publication d'une offre côté fonction (P4.11a) : la traduction des levées de publier_offre
// (0008, 0065) en refus affichables. Faux client Postgres.
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { type ClientPostgres } from './postgres.ts';
import { estIdentifiantOffre, publierOffre } from './publication-offre.ts';
import { TEXTES_REFUS } from './refus.ts';
import { ErreurPassagere } from './session-paiement.ts';

const OFFRE = '5a267d2e-9a68-47e4-bf62-c8b4b2319b84';

function fauxClient(reponse: { data: unknown; error: unknown }, appels: unknown[] = []) {
  return {
    rpc: (fonction: string, args: unknown) => {
      appels.push(fonction, args);
      return Promise.resolve(reponse);
    },
  } as unknown as ClientPostgres;
}

const levee = (message: string, details: string | null = null) => ({
  data: null,
  error: { code: 'P0001', message, details },
});

Deno.test('publication acceptée : 200, publier_offre appelée avec l’identifiant', async () => {
  const appels: unknown[] = [];
  const reponse = await publierOffre(fauxClient({ data: null, error: null }, appels), OFFRE);
  strictEqual(reponse.status, 200);
  deepStrictEqual(await reponse.json(), { publiee: true });
  deepStrictEqual(appels, ['publier_offre', { offre_id: OFFRE }]);
});

for (const [message, code, statut] of [
  ['offre introuvable ou non possedee par ce compte', 'offre_introuvable', 404],
  ['engagement_humain_requis', 'engagement_humain_requis', 422],
  ['coach_non_verifie', 'identite_non_verifiee', 409],
  ['termes_interdits', 'termes_interdits', 422],
  ['engagement_messagerie_indisponible', 'engagement_messagerie_indisponible', 422],
] as const) {
  Deno.test(`levée « ${message} » : ${statut} ${code}, avec son titre et son détail`, async () => {
    const reponse = await publierOffre(fauxClient(levee(message, 'illimité')), OFFRE);
    strictEqual(reponse.status, statut);
    strictEqual(reponse.headers.get('Content-Type'), 'application/problem+json');
    deepStrictEqual(await reponse.json(), {
      code,
      title: TEXTES_REFUS[code].title,
      detail: TEXTES_REFUS[code].detail,
      status: statut,
    });
  });
}

Deno.test('le coach qui publie ne lit jamais le texte destiné au client qui s’abonne', async () => {
  const reponse = await publierOffre(fauxClient(levee('coach_non_verifie')), OFFRE);
  const corps = (await reponse.json()) as { title: string };
  strictEqual(corps.title === TEXTES_REFUS.coach_non_verifie.title, false);
});

Deno.test('le terme trouvé n’est jamais rendu à l’application', async () => {
  const reponse = await publierOffre(fauxClient(levee('termes_interdits', 'premium')), OFFRE);
  strictEqual(JSON.stringify(await reponse.json()).includes('"premium"'), false);
});

Deno.test('jeton sans compte (42501) : 401 non_authentifie, pas une panne', async () => {
  const reponse = await publierOffre(
    fauxClient({ data: null, error: { code: '42501', message: 'permission denied' } }),
    OFFRE,
  );
  strictEqual(reponse.status, 401);
  strictEqual(((await reponse.json()) as { code: string }).code, 'non_authentifie');
});

Deno.test('une levée inconnue, ou une panne, n’est pas un refus : erreur passagère', async () => {
  await rejects(() => publierOffre(fauxClient(levee('autre_chose')), OFFRE), ErreurPassagere);
  await rejects(
    () => publierOffre(fauxClient({ data: null, error: { message: 'réseau' } }), OFFRE),
    ErreurPassagere,
  );
});

Deno.test('identifiant d’offre : un UUID, rien d’autre', () => {
  strictEqual(estIdentifiantOffre(OFFRE), true);
  for (const valeur of [undefined, '', 'offre-publication', '123', `${OFFRE}x`]) {
    strictEqual(estIdentifiantOffre(valeur), false, String(valeur));
  }
});
