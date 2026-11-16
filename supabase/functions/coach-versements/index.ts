// POST /functions/v1/coach-versements -- docs/api.md §8, « POST /coach/versements » (mode
// immédiat, 1 € de frais). L5, P5.4b.
//
// La base décide sous le jeton du coach (demander_versement_immediat, 0074) ; le virement part
// tout de suite chez le prestataire. Le solde et la liste se lisent directement (mon_solde,
// mes_versements) : aucune fonction ici pour eux.
import { ConfigurationIncomplete } from '../_partage/environnement.ts';
import { preflightCors } from '../_partage/http.ts';
import { clientDuClient, clientServeur } from '../_partage/postgres.ts';
import { versementsStripe } from '../_partage/prestataire-stripe.ts';
import { reponseRefus } from '../_partage/refus.ts';
import { ErreurPassagere } from '../_partage/session-paiement.ts';
import { clientStripe, descriptionErreurStripe } from '../_partage/stripe.ts';
import { demanderVersementImmediat } from '../_partage/versements.ts';

function traiter(requete: Request): Response | Promise<Response> {
  if (requete.method === 'OPTIONS') return preflightCors();
  if (requete.method !== 'POST') return reponseRefus(405, 'methode_interdite');
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseRefus(401, 'non_authentifie');
  return demanderVersementImmediat(
    clientDuClient(autorisation),
    clientServeur(),
    versementsStripe(clientStripe()),
  );
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'erreur_passagere');
    console.error(`coach-versements : ${code}`);
    return reponseRefus(500, 'erreur_passagere');
  }
});
