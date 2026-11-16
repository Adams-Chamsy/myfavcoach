// docs/api.md §8 (L5, P5.2) — l'identification du coach.
//
//   POST /functions/v1/coach-identification                    où en est le coach : compte de
//                                                              versement (relu chez Stripe),
//                                                              identité fiscale, publication
//   POST /functions/v1/coach-identification/lien               la page d'inscription de Stripe
//   POST /functions/v1/coach-identification/identite-fiscale   enregistre l'identité fiscale
//
// Chaque appel établit d'abord, SOUS LE JETON DU COACH, de quel profil il s'agit
// (mon_identification, 0069) ; le rôle serveur ne sert qu'ensuite, pour ce que seul le serveur a
// le droit de faire (lire la référence du compte, poser son état). L'adresse de la page de
// Stripe n'est jamais gardée ; la référence du compte ne sort jamais.
import {
  creerLienIdentification,
  enregistrerIdentiteFiscale,
  lireIdentification,
  lireSaisieIdentiteFiscale,
} from '../_partage/compte-versement.ts';
import { ConfigurationIncomplete, lireSecret } from '../_partage/environnement.ts';
import { preflightCors } from '../_partage/http.ts';
import { clientDuClient, clientServeur } from '../_partage/postgres.ts';
import { comptesStripe } from '../_partage/prestataire-stripe.ts';
import { reponseRefus } from '../_partage/refus.ts';
import { ErreurPassagere } from '../_partage/session-paiement.ts';
import { clientStripe, descriptionErreurStripe } from '../_partage/stripe.ts';

async function traiter(requete: Request): Promise<Response> {
  if (requete.method === 'OPTIONS') return preflightCors();
  if (requete.method !== 'POST') return reponseRefus(405, 'methode_interdite');
  const autorisation = requete.headers.get('Authorization');
  if (!autorisation) return reponseRefus(401, 'non_authentifie');
  const duCoach = clientDuClient(autorisation);

  // /functions/v1/coach-identification[/lien|/identite-fiscale]
  const segments = new URL(requete.url).pathname.split('/').filter(Boolean);
  const action = segments[segments.length - 1];

  if (action === 'identite-fiscale') {
    let corps: unknown;
    try {
      corps = await requete.json();
    } catch {
      return reponseRefus(400, 'corps_invalide');
    }
    const saisie = lireSaisieIdentiteFiscale(corps);
    if (!saisie) return reponseRefus(400, 'corps_invalide');
    return enregistrerIdentiteFiscale(duCoach, saisie);
  }

  const prestataire = comptesStripe(clientStripe());
  if (action === 'lien') {
    const retour = new URL(lireSecret('URL_RETOUR_PAIEMENT'));
    retour.searchParams.set('identification', 'retour');
    const reprise = new URL(lireSecret('URL_RETOUR_PAIEMENT'));
    reprise.searchParams.set('identification', 'reprise');
    return creerLienIdentification(
      duCoach,
      clientServeur(),
      prestataire,
      // L'adresse et le nom du coach, lus sous son jeton, pour le profil que la base a désigné.
      async (profilCoachId) => {
        const { data: utilisateur } = await duCoach.auth.getUser();
        const { data: profil } = await duCoach
          .from('profils_coach')
          .select('prenom, nom')
          .eq('id', profilCoachId)
          .maybeSingle<{ prenom: string; nom: string | null }>();
        return {
          email: utilisateur.user?.email ?? null,
          nomAffiche: [profil?.prenom, profil?.nom].filter(Boolean).join(' ') || 'Coach',
        };
      },
      { retour: retour.toString(), reprise: reprise.toString() },
    );
  }
  if (action === 'coach-identification') {
    return lireIdentification(duCoach, clientServeur(), prestataire);
  }
  return reponseRefus(405, 'methode_interdite');
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'erreur_passagere');
    console.error(`coach-identification : ${code}`);
    return reponseRefus(500, 'erreur_passagere');
  }
});
