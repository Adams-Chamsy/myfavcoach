// Le dépôt et la modification d'un avis côté fonction (P4.9a) : la forme du corps, la traduction
// des refus de 0049, et le nombre de jours accordé. Faux client Postgres.
import { deepStrictEqual, rejects, strictEqual } from 'node:assert';
import { ecrireAvis, lireSaisie, type SaisieAvis } from './avis.ts';
import { type ClientPostgres } from './postgres.ts';
import { ErreurPassagere } from './session-paiement.ts';

const COACH = '6841f036-237a-48ba-b116-8569998b715c';
const SAISIE: SaisieAvis = { coachId: COACH, note: 4, etiquettes: ['ecoute'], texte: 'Bien' };

function fauxClient(reponse: { data: unknown; error: unknown }, appels: unknown[] = []) {
  return {
    rpc: (fonction: string, args: unknown) => {
      appels.push(fonction, args);
      return Promise.resolve(reponse);
    },
  } as unknown as ClientPostgres;
}

const refusSql = (message: string, details: string | null = null) => ({
  data: null,
  error: { code: 'P0001', message, details },
});

Deno.test('lireSaisie : un corps complet, étiquettes et texte facultatifs', () => {
  deepStrictEqual(lireSaisie({ coachId: COACH, note: 5 }), {
    coachId: COACH,
    note: 5,
    etiquettes: [],
    texte: null,
  });
  deepStrictEqual(lireSaisie(SAISIE), SAISIE);
});

Deno.test('lireSaisie : un corps mal formé est refusé (les bornes, elles, sont au serveur)', () => {
  for (const corps of [
    null,
    { note: 4 },
    { coachId: 'pas-un-uuid', note: 4 },
    { coachId: COACH, note: '4' },
    { coachId: COACH, note: 4.5 },
    { coachId: COACH, note: 4, etiquettes: 'ecoute' },
    { coachId: COACH, note: 4, etiquettes: [1] },
    { coachId: COACH, note: 4, texte: 12 },
  ]) {
    strictEqual(lireSaisie(corps), null, JSON.stringify(corps));
  }
  // Une note hors bornes passe la forme : c'est 0049 qui la refuse, avec son texte.
  strictEqual(lireSaisie({ coachId: COACH, note: 9 })?.note, 9);
});

Deno.test('dépôt accepté : 201 et l’identifiant, deposer_avis appelé avec la saisie', async () => {
  const appels: unknown[] = [];
  const reponse = await ecrireAvis(
    fauxClient({ data: 'avis-1', error: null }, appels),
    'depot',
    SAISIE,
  );
  strictEqual(reponse.status, 201);
  deepStrictEqual(await reponse.json(), { avisId: 'avis-1' });
  deepStrictEqual(appels, [
    'deposer_avis',
    { p_coach_id: COACH, p_note: 4, p_etiquettes: ['ecoute'], p_texte: 'Bien' },
  ]);
});

Deno.test('modification acceptée : 200, modifier_avis appelé', async () => {
  const appels: unknown[] = [];
  const reponse = await ecrireAvis(
    fauxClient({ data: 'avis-1', error: null }, appels),
    'modification',
    SAISIE,
  );
  strictEqual(reponse.status, 200);
  strictEqual(appels[0], 'modifier_avis');
});

Deno.test('avis_pas_encore : 403, le nombre du serveur, accordé', async () => {
  for (const [jours, attendu] of [
    ['1', 'Il te reste 1 jour de suivi avant de pouvoir donner ton avis.'],
    ['12', 'Il te reste 12 jours de suivi avant de pouvoir donner ton avis.'],
    [null, 'Encore quelques jours de suivi avant de pouvoir donner ton avis.'],
  ] as const) {
    const reponse = await ecrireAvis(
      fauxClient(refusSql('avis_pas_encore', jours)),
      'depot',
      SAISIE,
    );
    strictEqual(reponse.status, 403);
    strictEqual(reponse.headers.get('Content-Type'), 'application/problem+json');
    deepStrictEqual(await reponse.json(), {
      code: 'avis_pas_encore',
      title: "Pas encore d'avis possible",
      detail: attendu,
      status: 403,
    });
  }
});

Deno.test('chaque refus de 0049 a son statut', async () => {
  for (const [code, statut] of [
    ['avis_suivi_interrompu', 403],
    ['avis_impossible', 403],
    ['avis_deja_donne', 409],
    ['avis_fige', 409],
    ['avis_invalide', 422],
    ['profil_client_requis', 403],
  ] as const) {
    const reponse = await ecrireAvis(fauxClient(refusSql(code)), 'depot', SAISIE);
    strictEqual(reponse.status, statut, code);
    strictEqual(((await reponse.json()) as { code: string }).code, code);
  }
});

Deno.test('une erreur qui n’est pas un refus métier remonte, rien n’est inventé', async () => {
  await rejects(
    ecrireAvis(fauxClient(refusSql('transition_interdite')), 'depot', SAISIE),
    ErreurPassagere,
  );
  await rejects(
    ecrireAvis(fauxClient({ data: null, error: { message: 'réseau' } }), 'depot', SAISIE),
    ErreurPassagere,
  );
});

// Trouvé en sondant la fonction déployée : appelée avec la seule clé anonyme, la base refuse
// l'exécution (42501, aucun grant à anon) et la fonction répondait 500 « On a un souci de notre
// côté » — faux : c'est une session absente.
Deno.test('sans session (exécution refusée à anon, 42501) : 401 non_authentifie', async () => {
  const reponse = await ecrireAvis(
    fauxClient({
      data: null,
      error: { code: '42501', message: 'permission denied for function deposer_avis' },
    }),
    'depot',
    SAISIE,
  );
  strictEqual(reponse.status, 401);
  strictEqual(((await reponse.json()) as { code: string }).code, 'non_authentifie');
});
