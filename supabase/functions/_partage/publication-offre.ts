// La publication d'une offre (P4.11a) : la fonction SQL décide (publier_offre, 0008 et 0065), ce
// module traduit sa réponse pour l'application. Même motif que l'avis et l'intention de
// souscription : la base lève un code, _partage/refus.ts porte le texte (docs/api.md §1).
import { reponseJson } from './http.ts';
import { type ClientPostgres, codeMetier } from './postgres.ts';
import { REFUS_PUBLICATION_OFFRE, reponseRefus } from './refus.ts';
import { ErreurPassagere } from './session-paiement.ts';

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function estIdentifiantOffre(valeur: string | undefined): valeur is string {
  return typeof valeur === 'string' && FORMAT_UUID.test(valeur);
}

export async function publierOffre(duCoach: ClientPostgres, offreId: string): Promise<Response> {
  const { error } = await duCoach.rpc('publier_offre', { offre_id: offreId });
  if (!error) return reponseJson(200, { publiee: true });
  // Exécution refusée : seul `authenticated` a le droit (0031). Un jeton sans compte (la clé
  // anonyme) n'est pas une panne du serveur, c'est une session absente.
  if ((error as { code?: string }).code === '42501') return reponseRefus(401, 'non_authentifie');
  const code = codeMetier(error);
  const refus = code === null ? undefined : REFUS_PUBLICATION_OFFRE[code];
  if (refus) {
    // Le terme trouvé (DETAIL de la levée, 0065) va au journal, jamais à l'écran : c'est un mot
    // d'une liste publique, pas une donnée personnelle.
    if (code === 'termes_interdits') {
      const terme = (error as { details?: string | null }).details ?? 'inconnu';
      console.warn(`offre-publication : termes_interdits (${terme})`);
    }
    return reponseRefus(refus.statut, refus.code);
  }
  throw new ErreurPassagere(code ?? 'publication_offre_echouee');
}
