// POST /functions/v1/avis -- dépôt ; PATCH /functions/v1/avis -- modification (P4.9a ;
// docs/api.md §5, docs/ecrans/L4-27a-depot-avis.md). Corps : { coachId, note, etiquettes?, texte? }.
//
// La fonction SQL décide de tout (deposer_avis, modifier_avis, 0049), sous le jeton du CLIENT :
// auth.uid() est le sien, l'éligibilité est la sienne. Cette fonction ne fait que traduire un
// refus en texte (_partage/refus.ts, docs/api.md §1). Aucune clé d'idempotence : rien ne déplace
// d'argent, et un second dépôt est refusé par la base (avis_deja_donne).
import { ConfigurationIncomplete } from '../_partage/environnement.ts';
import { preflightCors } from '../_partage/http.ts';
import { ecrireAvis, lireSaisie } from '../_partage/avis.ts';
import { clientDuClient } from '../_partage/postgres.ts';
import { reponseRefus } from '../_partage/refus.ts';
import { ErreurPassagere } from '../_partage/session-paiement.ts';

async function traiter(requete: Request): Promise<Response> {
  if (requete.method === 'OPTIONS') return preflightCors();
  if (requete.method !== 'POST' && requete.method !== 'PATCH') {
    return reponseRefus(405, 'methode_interdite');
  }
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseRefus(401, 'non_authentifie');

  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return reponseRefus(400, 'corps_invalide');
  }
  const saisie = lireSaisie(corps);
  if (!saisie) return reponseRefus(400, 'corps_invalide');

  return ecrireAvis(
    clientDuClient(autorisation),
    requete.method === 'POST' ? 'depot' : 'modification',
    saisie,
  );
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : 'erreur_passagere';
    console.error(`avis : ${code}`);
    return reponseRefus(500, 'erreur_passagere');
  }
});
