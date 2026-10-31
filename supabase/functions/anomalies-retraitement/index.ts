// POST /functions/v1/anomalies-retraitement -- usage interne, jamais appelé par l'application.
// Corps facultatif : { "session": "cs_..." } pour ne retraiter que les anomalies d'une session.
//
// Rattrape les anomalies de paiement ouvertes une fois un défaut de notre code corrigé
// (_partage/retraitement.ts, migration 0040). Rend le bilan, anomalie par anomalie : résolue, ou
// encore ouverte et pourquoi.
//
// Qui peut l'appeler : le serveur seul (sa clé d'administration). La fonction ne décode pas le jeton :
// elle lit la liste des anomalies AVEC le jeton de l'appelant (clientDuClient), et Postgres refuse
// quiconque n'a pas le rôle du serveur -- 403 (docs/backend.md §12). verify_jwt par défaut.
import { ConfigurationIncomplete } from '../_partage/environnement.ts';
import { reponseCode, reponseJson } from '../_partage/http.ts';
import { clientDuClient, clientServeur } from '../_partage/postgres.ts';
import { RefusAppelant, retraiterAnomalies } from '../_partage/retraitement.ts';
import { ErreurPassagere, relireSession } from '../_partage/session-paiement.ts';
import { clientStripe, descriptionErreurStripe } from '../_partage/stripe.ts';

async function sessionDemandee(requete: Request): Promise<string | null | undefined> {
  const texte = await requete.text();
  if (texte.trim() === '') return null;
  try {
    const corps = JSON.parse(texte) as { session?: unknown };
    if (corps.session === undefined) return null;
    return typeof corps.session === 'string' && corps.session.startsWith('cs_')
      ? corps.session
      : undefined;
  } catch {
    return undefined;
  }
}

async function traiter(requete: Request): Promise<Response> {
  if (requete.method !== 'POST') return reponseCode(405, 'methode_interdite');
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseCode(401, 'non_authentifie');
  const session = await sessionDemandee(requete);
  if (session === undefined) return reponseCode(400, 'session_invalide');

  const stripe = clientStripe();
  try {
    const bilan = await retraiterAnomalies(
      clientDuClient(autorisation),
      clientServeur(),
      (id) => relireSession(stripe, id),
      session,
    );
    return reponseJson(200, {
      resolues: bilan.filter((b) => b.issue === 'resolue').length,
      ouvertes: bilan.filter((b) => b.issue === 'ouverte').length,
      bilan,
    });
  } catch (erreur) {
    if (erreur instanceof RefusAppelant) return reponseCode(403, 'reserve_au_serveur');
    throw erreur;
  }
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'erreur_passagere');
    console.error(`anomalies-retraitement : ${code}`);
    return reponseCode(500, 'erreur_passagere');
  }
});
