// POST /functions/v1/abonnement-intention -- docs/api.md §7, « Intention »
// (`POST /abonnements/intention`, correspondance dans docs/backend.md §13).
// Corps : { "offreId": "…" } ; en-tête Idempotency-Key obligatoire (un UUID).
//
// Déroulé (docs/backend.md §13, « Idempotence des appels sortants ») :
//   1. réserver la clé d'idempotence -- jeton du CLIENT (auth.uid() est lu) ;
//   2. créer l'intention -- jeton du client : elle refuse une offre indisponible, un coach non
//      vérifié, son propre coach, AVANT toute page de paiement ;
//   3. créer la session Checkout chez Stripe, avec l'identifiant d'intention en métadonnées
//      (posé par nous, avec la clé secrète : le client ne peut pas le forger) ;
//   4. poser la session sur l'intention -- rôle SERVEUR seul (docs/backend.md §13, « un lien ne
//      se déclare jamais par le client ») ;
//   5. terminer la clé avec la réponse, pour qu'un nouvel essai réseau la rejoue telle quelle.
import { ConfigurationIncomplete, lireSecret } from '../_partage/environnement.ts';
import { preflightCors, reponseCode, reponseJson } from '../_partage/http.ts';
import {
  type ClientPostgres,
  clientDuClient,
  clientServeur,
  codeMetier,
} from '../_partage/postgres.ts';
import { ErreurPassagere } from '../_partage/session-paiement.ts';
import { clientStripe, descriptionErreurStripe } from '../_partage/stripe.ts';

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATION = 'intention_souscription';

// Refus de creer_intention_souscription (0037) : définitifs pour cette requête, mémorisés avec la
// clé (un nouvel essai réseau rend la même réponse). docs/api.md §7.
const REFUS_INTENTION: Record<string, number> = {
  offre_indisponible: 409,
  coach_non_verifie: 409,
  auto_abonnement_interdit: 409,
  profil_client_requis: 403,
};

type Reservation = { etat: string; code_reponse: number | null; corps_reponse: unknown };
type LigneIntention = {
  intention_id: string;
  titre: string;
  prix_centimes: number;
  jour_prelevement: number;
  prochain_prelevement_le: string;
  expire_le: string;
};

async function empreinte(texte: string): Promise<string> {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, '0')).join('');
}

async function terminer(
  duClient: ClientPostgres,
  cle: string,
  statut: number,
  corps: Record<string, unknown>,
): Promise<Response> {
  const { error } = await duClient.rpc('terminer_cle_idempotence', {
    p_cle: cle,
    p_code: statut,
    p_corps: corps,
  });
  if (error) throw new ErreurPassagere(codeMetier(error) ?? 'cle_non_terminee');
  return reponseJson(statut, corps);
}

async function traiter(requete: Request): Promise<Response> {
  if (requete.method === 'OPTIONS') return preflightCors();
  if (requete.method !== 'POST') return reponseCode(405, 'methode_interdite');
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseCode(401, 'non_authentifie');

  const cle = requete.headers.get('Idempotency-Key') ?? '';
  if (!FORMAT_UUID.test(cle)) return reponseCode(400, 'cle_idempotence_requise');
  let offreId: unknown;
  try {
    offreId = ((await requete.json()) as { offreId?: unknown }).offreId;
  } catch {
    return reponseCode(400, 'corps_invalide');
  }
  if (typeof offreId !== 'string' || !FORMAT_UUID.test(offreId)) {
    return reponseCode(400, 'corps_invalide');
  }

  const duClient = clientDuClient(autorisation);

  // 1. Réserver la clé.
  const reservation = await duClient
    .rpc('reserver_cle_idempotence', {
      p_cle: cle,
      p_operation: OPERATION,
      p_empreinte: await empreinte(offreId),
    })
    .single<Reservation>();
  if (reservation.error) {
    const code = codeMetier(reservation.error);
    if (code === 'cle_idempotence_reutilisee') return reponseCode(422, code);
    throw new ErreurPassagere(code ?? 'reservation_echouee');
  }
  const { etat, code_reponse, corps_reponse } = reservation.data;
  if (etat === 'rejouee' && code_reponse !== null) return reponseJson(code_reponse, corps_reponse);
  if (etat === 'en_cours') {
    return reponseJson(409, { code: 'requete_en_cours' }, { 'Retry-After': '5' });
  }
  // etat 'nouvelle' ou 'reprise' : on traite.
  //
  // Une erreur PASSAGÈRE à partir d'ici (Stripe ou base injoignables) ne termine pas la clé :
  // elle reste en cours, un nouvel essai avec la même clé rend 409 pendant cinq minutes puis la
  // reprend (péremption de 0034). L'application génère une clé neuve à chaque nouvelle action du
  // client, qui n'attend donc pas.

  // 2. L'intention.
  const intention = await duClient
    .rpc('creer_intention_souscription', { p_offre_id: offreId })
    .single<LigneIntention>();
  if (intention.error) {
    const code = codeMetier(intention.error);
    if (code && code in REFUS_INTENTION) {
      return terminer(duClient, cle, REFUS_INTENTION[code], { code });
    }
    throw new ErreurPassagere(code ?? 'intention_echouee');
  }
  const i = intention.data;

  // 3. La session Checkout. Expiration : Stripe exige au moins 30 minutes après SA réception de
  //    la requête ; une minute de marge, pour qu'un léger écart d'horloge ne la fasse pas refuser.
  const urlRetour = new URL(lireSecret('URL_RETOUR_PAIEMENT'));
  urlRetour.searchParams.set('intention', i.intention_id);
  const session = await clientStripe().checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card', 'sepa_debit'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: i.prix_centimes,
            product_data: { name: i.titre },
          },
        },
      ],
      // Le moyen de paiement est enregistré pour les échéances suivantes, prélevées hors session
      // par le serveur (P4.8) : il faut un client Stripe pour le porter.
      customer_creation: 'always',
      payment_intent_data: { setup_future_usage: 'off_session' },
      metadata: { intention_id: i.intention_id },
      client_reference_id: i.intention_id,
      locale: 'fr',
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: urlRetour.toString(),
      cancel_url: urlRetour.toString(),
    },
    // Dérivée de l'INTENTION, pas de la clé du client (docs/backend.md §13, corrigé en P4.5b) :
    // une reprise crée une nouvelle intention, que Stripe refuserait sous l'ancienne clé.
    { idempotencyKey: `intention-${i.intention_id}` },
  );
  if (!session.url) throw new ErreurPassagere('session_sans_url');

  // 4. Le lien intention -> session, posé par le serveur.
  const pose = await clientServeur().rpc('attacher_session_intention', {
    p_intention_id: i.intention_id,
    p_session: session.id,
  });
  if (pose.error) throw new ErreurPassagere(codeMetier(pose.error) ?? 'session_non_posee');

  // 5. La réponse, mémorisée avec la clé.
  return terminer(duClient, cle, 201, {
    intentionId: i.intention_id,
    recapitulatif: {
      prixCentimes: i.prix_centimes,
      // Aucune remise au jalon 1 (docs/api.md §7) : le total vaut le prix.
      totalCentimes: i.prix_centimes,
      prochainPrelevementLe: i.prochain_prelevement_le,
      jourPrelevement: i.jour_prelevement,
    },
    urlPaiement: session.url,
    moyensAcceptes: ['carte', 'sepa'],
  });
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'erreur_passagere');
    console.error(`abonnement-intention : ${code}`);
    return reponseCode(500, 'erreur_passagere');
  }
});
