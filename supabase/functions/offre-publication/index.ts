// POST /functions/v1/offre-publication/{offreId} -- docs/api.md §5, « POST /offres/{id}/publication »
// (P4.11a, 15 novembre 2026).
//
// La fonction SQL décide de tout (publier_offre, 0008 et 0065), sous le jeton du COACH : auth.uid()
// est le sien, l'offre doit être la sienne. Cette fonction ne fait que traduire un refus en texte
// (_partage/refus.ts, docs/api.md §1) : jusqu'ici, l'écran choisissait lui-même son libellé à
// partir du code (docs/dette.md). Aucune clé d'idempotence : rien ne déplace d'argent, et publier
// deux fois la même offre la laisse publiée.
import { ConfigurationIncomplete } from '../_partage/environnement.ts';
import { preflightCors } from '../_partage/http.ts';
import { clientDuClient } from '../_partage/postgres.ts';
import { estIdentifiantOffre, publierOffre } from '../_partage/publication-offre.ts';
import { reponseRefus } from '../_partage/refus.ts';
import { ErreurPassagere } from '../_partage/session-paiement.ts';

// Pas `async` : rien n'est attendu ici, la promesse de publierOffre est rendue telle quelle.
function traiter(requete: Request): Response | Promise<Response> {
  if (requete.method === 'OPTIONS') return preflightCors();
  if (requete.method !== 'POST') return reponseRefus(405, 'methode_interdite');
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseRefus(401, 'non_authentifie');

  // /functions/v1/offre-publication/<offreId>
  const offreId = new URL(requete.url).pathname.split('/').filter(Boolean).pop();
  // Un identifiant mal formé ne désigne aucune offre : même réponse qu'une offre d'un autre.
  if (!estIdentifiantOffre(offreId)) return reponseRefus(404, 'offre_introuvable');

  return publierOffre(clientDuClient(autorisation), offreId);
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : 'erreur_passagere';
    console.error(`offre-publication : ${code}`);
    return reponseRefus(500, 'erreur_passagere');
  }
});
