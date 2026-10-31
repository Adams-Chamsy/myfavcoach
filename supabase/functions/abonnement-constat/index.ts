// POST /functions/v1/abonnement-constat/{intentionId} -- docs/api.md §7, « Constat »
// (`POST /abonnements/intention/{id}/constat`, correspondance dans docs/backend.md §13).
//
// L'application le demande au retour de la page Stripe, ou quand le client revient sans aucun
// retour. Le serveur ne se contente pas d'attendre le webhook : il relit la session chez Stripe
// et, si elle est payée, applique LE MÊME traitement (_partage/session-paiement.ts) -- le
// premier des deux qui arrive crée l'abonnement, le second ne fait rien.
//
// Appelée avec le jeton du client (verify_jwt par défaut) : clientDuClient pour vérifier que
// l'intention est bien la sienne (mon_intention), clientServeur pour la synchronisation, que seul
// le serveur a le droit de faire.
import { ConfigurationIncomplete } from '../_partage/environnement.ts';
import { preflightCors, reponseCode, reponseJson } from '../_partage/http.ts';
import { clientDuClient, clientServeur, codeMetier } from '../_partage/postgres.ts';
import {
  ErreurPassagere,
  intentionDeLaSession,
  relireSession,
  type Synchronisation,
  synchroniserSession,
} from '../_partage/session-paiement.ts';
import { clientStripe, descriptionErreurStripe } from '../_partage/stripe.ts';

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LigneIntention = { session_prestataire: string | null; expire_le: string };
type LigneAbonnement = {
  id: string;
  statut: string;
  prix_fige_centimes: number;
  jour_prelevement: number;
  prochain_prelevement_le: string;
};

async function abonnementCree(idSession: string): Promise<Response> {
  const { data, error } = await clientServeur()
    .from('abonnements')
    .select('id,statut,prix_fige_centimes,jour_prelevement,prochain_prelevement_le')
    .eq('reference_paiement', idSession)
    .single<LigneAbonnement>();
  if (error || !data) throw new ErreurPassagere('abonnement_illisible');
  return reponseJson(200, {
    etat: 'abonne',
    abonnement: {
      id: data.id,
      statut: data.statut,
      prixCentimes: data.prix_fige_centimes,
      jourPrelevement: data.jour_prelevement,
      prochainPrelevementLe: data.prochain_prelevement_le,
    },
  });
}

async function traiter(requete: Request): Promise<Response> {
  if (requete.method === 'OPTIONS') return preflightCors();
  if (requete.method !== 'POST') return reponseCode(405, 'methode_interdite');
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseCode(401, 'non_authentifie');

  // Dernier segment du chemin : /functions/v1/abonnement-constat/<intentionId>
  const intentionId = new URL(requete.url).pathname.split('/').filter(Boolean).pop() ?? '';
  if (!FORMAT_UUID.test(intentionId)) return reponseCode(404, 'intention_introuvable');

  // 1. L'intention est-elle la sienne ? Une intention d'autrui et une intention inexistante
  //    rendent la même réponse.
  const { data, error } = await clientDuClient(autorisation)
    .rpc('mon_intention', { p_intention_id: intentionId })
    .single<LigneIntention>();
  if (error) {
    const code = codeMetier(error);
    if (code === 'intention_introuvable') return reponseCode(404, code);
    throw new ErreurPassagere(code ?? 'intention_illisible');
  }

  // 2. Aucune session posée : la création s'est arrêtée avant de la rendre au client, qui n'a
  //    donc jamais pu payer celle-ci. Il lui faut une nouvelle intention.
  if (!data.session_prestataire) return reponseJson(200, { etat: 'expiree' });

  // 3. L'état, relu chez Stripe.
  const session = await relireSession(clientStripe(), data.session_prestataire);
  if (intentionDeLaSession(session) !== intentionId) {
    // La session posée par le serveur ne désigne pas cette intention : impossible sans défaut.
    throw new ErreurPassagere('session_incoherente');
  }

  let synchronisation: Synchronisation;
  try {
    synchronisation = await synchroniserSession(clientServeur(), session, null);
  } catch (erreur) {
    // Traitement momentanément impossible : si Stripe a le paiement, le client doit le savoir
    // (docs/api.md §7, `paiement_recu` : « notre abonnement pas encore »). Le webhook, ou le
    // constat suivant, créera l'abonnement.
    if (erreur instanceof ErreurPassagere && session.status === 'complete') {
      return reponseJson(200, { etat: 'paiement_recu' });
    }
    throw erreur;
  }

  switch (synchronisation.type) {
    case 'ignoree':
      throw new ErreurPassagere('session_sans_intention');
    case 'incoherence':
      console.error(`abonnement-constat : ${synchronisation.motif}`);
      return reponseJson(200, { etat: 'souscription_impossible' });
    case 'resultat':
      switch (synchronisation.resultat) {
        case 'non_terminee':
          return reponseJson(200, { etat: 'non_terminee', urlPaiement: session.url });
        case 'expiree':
          return reponseJson(200, { etat: 'expiree' });
        // docs/api.md §7 : le motif (coach écarté) n'est jamais transmis au client.
        case 'coach_ecarte':
        case 'intention_inconnue':
          return reponseJson(200, { etat: 'souscription_impossible' });
        case 'abonne':
        case 'deja_traite':
          return abonnementCree(session.id);
      }
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
    console.error(`abonnement-constat : ${code}`);
    return reponseCode(500, 'erreur_passagere');
  }
});
