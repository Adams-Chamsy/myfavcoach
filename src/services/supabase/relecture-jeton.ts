// Juste après une connexion, PostgREST peut refuser la première requête en
// `401 PGRST303 « JWT issued at future »` : le jeton est daté par le serveur d'authentification
// de Supabase, dont l'horloge est un peu en avance sur celle de PostgREST. Trouvé le 11 novembre
// 2026 (un compte connecté renvoyé vers l'accueil client, « Salut » sans prénom), expliqué le 12.
//
// Décidé le 12 novembre 2026 : relire UNE fois, après une seconde. Sans risque pour une écriture :
// PostgREST refuse le jeton avant d'exécuter quoi que ce soit, la première requête n'a rien fait.
// Une fois seulement : un refus qui persiste remonte tel quel, et l'appelant affiche une erreur.
export const DELAI_RELECTURE_MS = 1000;

async function jetonDuFutur(reponse: Response): Promise<boolean> {
  if (reponse.status !== 401) return false;
  try {
    const corps = (await reponse.clone().json()) as { code?: string };
    return corps?.code === 'PGRST303';
  } catch {
    return false;
  }
}

export function avecRelectureJeton(fetchBrut: typeof fetch): typeof fetch {
  return async (entree, init) => {
    const premiere = await fetchBrut(entree, init);
    if (!(await jetonDuFutur(premiere))) return premiere;
    await new Promise((resolve) => setTimeout(resolve, DELAI_RELECTURE_MS));
    return fetchBrut(entree, init);
  };
}
