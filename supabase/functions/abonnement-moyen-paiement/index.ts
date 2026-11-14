// POST /functions/v1/abonnement-moyen-paiement/{abonnementId}          -- docs/api.md §7,
//   « POST /abonnements/{id}/moyen-paiement » : ouvre une page Stripe hébergée où enregistrer un
//   nouveau moyen de paiement, après un prélèvement refusé (écran 20).
// POST /functions/v1/abonnement-moyen-paiement/{abonnementId}/constat  -- au retour de la page,
//   ou quand le client revient sans aucun retour : le serveur relit la session chez Stripe et
//   applique LE MÊME traitement que le webhook (_partage/nouveau-moyen.ts).
//
// Appelée avec le jeton du client (verify_jwt par défaut) : clientDuClient pour vérifier que
// l'abonnement est le sien et en défaut de paiement (abonnement_pour_nouveau_moyen, 0060),
// clientServeur pour lire le client Stripe et poser la session, que seul le serveur a le droit
// de faire. Aucun paiement n'est engagé ici : la page enregistre le moyen, et c'est la tentative
// programmée le lendemain qui prélève (docs/domaine.md §4.4).
import { ConfigurationIncomplete, lireSecret } from '../_partage/environnement.ts';
import { preflightCors, reponseJson } from '../_partage/http.ts';
import { appliquerNouveauMoyen, relireSessionNouveauMoyen } from '../_partage/nouveau-moyen.ts';
import { clientDuClient, clientServeur, codeMetier } from '../_partage/postgres.ts';
import { reponseRefus } from '../_partage/refus.ts';
import { ErreurPassagere } from '../_partage/session-paiement.ts';
import { clientStripe, descriptionErreurStripe } from '../_partage/stripe.ts';

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type References = {
  reference_client_prestataire: string | null;
  reference_session_nouveau_moyen: string | null;
};

async function references(abonnementId: string): Promise<References> {
  const { data, error } = await clientServeur()
    .from('abonnements')
    .select('reference_client_prestataire,reference_session_nouveau_moyen')
    .eq('id', abonnementId)
    .maybeSingle<References>();
  if (error || !data) throw new ErreurPassagere('abonnement_illisible');
  return data;
}

async function ouvrirPage(abonnementId: string): Promise<Response> {
  const { reference_client_prestataire } = await references(abonnementId);
  // Aucun client Stripe conservé (abonnement antérieur à P4.8b) : aucune page ne pourrait
  // enregistrer un moyen pour lui. Même refus que hors défaut de paiement : la personne n'a rien
  // d'autre à faire ici.
  if (!reference_client_prestataire) {
    return reponseRefus(409, 'changement_moyen_impossible');
  }

  const urlRetour = new URL(lireSecret('URL_RETOUR_PAIEMENT'));
  urlRetour.searchParams.set('moyen', abonnementId);
  const session = await clientStripe().checkout.sessions.create({
    mode: 'setup',
    customer: reference_client_prestataire,
    payment_method_types: ['card', 'sepa_debit'],
    metadata: { abonnement_id: abonnementId, usage: 'nouveau_moyen' },
    client_reference_id: abonnementId,
    locale: 'fr',
    // Même durée que la page de paiement (docs/api.md §7) : 30 minutes, une de marge.
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: urlRetour.toString(),
    cancel_url: urlRetour.toString(),
  });
  if (!session.url) throw new ErreurPassagere('session_sans_url');

  const pose = await clientServeur().rpc('poser_session_nouveau_moyen', {
    p_abonnement_id: abonnementId,
    p_session: session.id,
  });
  if (pose.error) {
    throw new ErreurPassagere(codeMetier(pose.error) ?? 'session_non_posee');
  }
  return reponseJson(200, { urlPaiement: session.url });
}

async function constater(abonnementId: string): Promise<Response> {
  const { reference_session_nouveau_moyen } = await references(abonnementId);
  // Aucune page jamais ouverte pour cet abonnement : rien à constater.
  if (!reference_session_nouveau_moyen) {
    return reponseJson(200, { etat: 'aucune' });
  }
  const session = await relireSessionNouveauMoyen(clientStripe(), reference_session_nouveau_moyen);
  const resultat = await appliquerNouveauMoyen(clientServeur(), session);
  switch (resultat.type) {
    case 'enregistre':
      return reponseJson(200, {
        etat: 'enregistre',
        prochaineTentativeLe: resultat.prochaineTentativeLe,
      });
    case 'non_terminee':
      return reponseJson(200, {
        etat: 'non_terminee',
        urlPaiement: session.url,
      });
    case 'expiree':
      return reponseJson(200, { etat: 'expiree' });
    case 'moyen_illisible':
      console.error('abonnement-moyen-paiement : moyen_illisible');
      return reponseJson(200, { etat: 'aucune' });
    case 'ignoree':
      // La session posée par le serveur ne désigne pas cet abonnement : impossible sans défaut.
      throw new ErreurPassagere('session_incoherente');
  }
}

async function traiter(requete: Request): Promise<Response> {
  if (requete.method === 'OPTIONS') return preflightCors();
  if (requete.method !== 'POST') return reponseRefus(405, 'methode_interdite');
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseRefus(401, 'non_authentifie');

  // /functions/v1/abonnement-moyen-paiement/<abonnementId>[/constat]
  const segments = new URL(requete.url).pathname.split('/').filter(Boolean);
  const constat = segments.at(-1) === 'constat';
  const abonnementId = (constat ? segments.at(-2) : segments.at(-1)) ?? '';
  if (!FORMAT_UUID.test(abonnementId)) {
    return reponseRefus(404, 'abonnement_introuvable');
  }

  // 1. L'abonnement est-il le sien, et en défaut de paiement ? Un abonnement d'autrui et un
  //    abonnement inexistant rendent la même réponse. Au constat, le défaut de paiement n'est
  //    plus exigé : la relance a pu réussir entre-temps.
  const verification = await clientDuClient(autorisation).rpc(
    constat ? 'detail_abonnement' : 'abonnement_pour_nouveau_moyen',
    { p_abonnement_id: abonnementId },
  );
  if (verification.error) {
    const code = codeMetier(verification.error);
    if (code === 'abonnement_introuvable') return reponseRefus(404, code);
    if (code === 'changement_moyen_impossible') return reponseRefus(409, code);
    throw new ErreurPassagere(code ?? 'abonnement_illisible');
  }

  return constat ? constater(abonnementId) : ouvrirPage(abonnementId);
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'erreur_passagere');
    console.error(`abonnement-moyen-paiement : ${code}`);
    return reponseRefus(500, 'erreur_passagere');
  }
});
