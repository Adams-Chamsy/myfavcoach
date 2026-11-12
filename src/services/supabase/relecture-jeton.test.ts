import { avecRelectureJeton, DELAI_RELECTURE_MS } from './relecture-jeton';

// Trouvé le 11 novembre 2026, reproduit et expliqué le 12 : juste après une connexion, PostgREST
// refuse la première requête en `401 PGRST303 « JWT issued at future »` — le jeton est daté par le
// serveur d'authentification de Supabase, dont l'horloge est un peu en avance sur celle de
// PostgREST. Décidé le 12 novembre 2026 : relire une fois, après une seconde. Sans risque même
// pour une écriture : le jeton est refusé avant que la requête ne soit exécutée.
function reponse(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), { status: statut });
}
const JETON_DU_FUTUR = { code: 'PGRST303', message: 'JWT issued at future' };

describe('avecRelectureJeton', () => {
  afterEach(() => jest.useRealTimers());

  it('un 401 PGRST303 : une seule relecture, une seconde plus tard, et c’est sa réponse qui est rendue', async () => {
    jest.useFakeTimers();
    const fetchBrut = jest
      .fn()
      .mockResolvedValueOnce(reponse(401, JETON_DU_FUTUR))
      .mockResolvedValueOnce(reponse(200, [{ id: 'profil-1' }]));
    const appel = avecRelectureJeton(fetchBrut)(
      'https://exemple.supabase.co/rest/v1/profils_client',
    );

    await jest.advanceTimersByTimeAsync(DELAI_RELECTURE_MS - 1);
    expect(fetchBrut).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);

    const rendu = await appel;
    expect(fetchBrut).toHaveBeenCalledTimes(2);
    expect(rendu.status).toBe(200);
  });

  it('un autre 401 (jeton expiré, pas de session) : aucune relecture', async () => {
    const fetchBrut = jest.fn().mockResolvedValue(reponse(401, { code: 'PGRST301' }));
    const rendu = await avecRelectureJeton(fetchBrut)('https://exemple.supabase.co/rest/v1/x');
    expect(fetchBrut).toHaveBeenCalledTimes(1);
    expect(rendu.status).toBe(401);
  });

  it('un PGRST303 qui persiste : une seule relecture, jamais une boucle', async () => {
    jest.useFakeTimers();
    const fetchBrut = jest.fn().mockImplementation(async () => reponse(401, JETON_DU_FUTUR));
    const appel = avecRelectureJeton(fetchBrut)('https://exemple.supabase.co/rest/v1/x');
    await jest.advanceTimersByTimeAsync(DELAI_RELECTURE_MS * 5);
    const rendu = await appel;
    expect(fetchBrut).toHaveBeenCalledTimes(2);
    expect(rendu.status).toBe(401);
  });

  it('une réponse normale passe telle quelle, corps lisible', async () => {
    const fetchBrut = jest.fn().mockResolvedValue(reponse(200, { ok: true }));
    const rendu = await avecRelectureJeton(fetchBrut)('https://exemple.supabase.co/rest/v1/x');
    expect(await rendu.json()).toEqual({ ok: true });
  });
});
