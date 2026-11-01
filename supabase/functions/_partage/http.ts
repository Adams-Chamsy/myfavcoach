// Réponses HTTP communes aux Edge Functions.

// L'application web (Expo, autre origine que *.supabase.co) appelle abonnement-intention et
// abonnement-constat depuis le navigateur : sans ces en-têtes, le navigateur bloque la requête.
// « * » est sans risque ici : l'authentification passe par l'en-tête Authorization (jeton), jamais
// par un cookie que le navigateur enverrait tout seul. Le webhook n'en a pas besoin.
export const ENTETES_CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
};

export function reponseJson(
  statut: number,
  corps: unknown,
  entetes: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json', ...ENTETES_CORS, ...entetes },
  });
}

export function reponseCode(statut: number, code: string): Response {
  return reponseJson(statut, { code });
}

export function preflightCors(): Response {
  return new Response(null, { status: 204, headers: ENTETES_CORS });
}
