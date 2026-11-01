// Le dépôt et la modification d'un avis (P4.9a) : la fonction SQL décide (0049), ce module
// traduit sa réponse pour l'application. Même motif que l'intention de souscription : la base
// lève un code, _partage/refus.ts porte le texte (docs/api.md §1).
import { reponseJson } from './http.ts';
import { type ClientPostgres, codeMetier } from './postgres.ts';
import { type CodeRefus, reponseRefus, STATUTS_REFUS_AVIS } from './refus.ts';
import { ErreurPassagere } from './session-paiement.ts';

export type SaisieAvis = {
  coachId: string;
  note: number;
  etiquettes: string[];
  texte: string | null;
};

const FORMAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La FORME du corps seulement : les bornes (note de 1 à 5, 3 étiquettes, 600 caractères) sont
// vérifiées par 0049, qui les refuse avec un texte (avis_invalide). Ici, un corps qu'aucune
// fonction SQL ne pourrait recevoir.
export function lireSaisie(corps: unknown): SaisieAvis | null {
  if (typeof corps !== 'object' || corps === null) return null;
  const { coachId, note, etiquettes = [], texte = null } = corps as Record<string, unknown>;
  if (typeof coachId !== 'string' || !FORMAT_UUID.test(coachId)) return null;
  if (typeof note !== 'number' || !Number.isInteger(note)) return null;
  if (!Array.isArray(etiquettes) || !etiquettes.every((e) => typeof e === 'string')) return null;
  if (texte !== null && typeof texte !== 'string') return null;
  return { coachId, note, etiquettes, texte };
}

export async function ecrireAvis(
  duClient: ClientPostgres,
  operation: 'depot' | 'modification',
  saisie: SaisieAvis,
): Promise<Response> {
  const { data, error } = await duClient.rpc(
    operation === 'depot' ? 'deposer_avis' : 'modifier_avis',
    {
      p_coach_id: saisie.coachId,
      p_note: saisie.note,
      p_etiquettes: saisie.etiquettes,
      p_texte: saisie.texte,
    },
  );
  if (error) {
    // Exécution refusée : seul `authenticated` a le grant (0048). Un jeton sans compte (la clé
    // anonyme) n'est pas une panne du serveur, c'est une session absente.
    if ((error as { code?: string }).code === '42501') return reponseRefus(401, 'non_authentifie');
    const code = codeMetier(error);
    if (code !== null && code in STATUTS_REFUS_AVIS) {
      const refus = code as CodeRefus;
      // avis_pas_encore porte le nombre de jours restants en DETAIL de la levée (0049).
      const details = (error as { details?: string | null }).details;
      const nombre = details && /^\d+$/.test(details) ? Number(details) : null;
      return reponseRefus(STATUTS_REFUS_AVIS[refus] as number, refus, {}, nombre);
    }
    throw new ErreurPassagere(code ?? `${operation}_avis_echoue`);
  }
  return reponseJson(operation === 'depot' ? 201 : 200, { avisId: data });
}
