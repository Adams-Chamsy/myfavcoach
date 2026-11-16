// Les versements au coach (L5, P5.4b ; docs/domaine.md §3.10, §4.8 ; docs/prompts/L5.md,
// décisions 3 et 5) : la base décide QUOI verser (0073, 0074), ce module fait partir le virement
// chez le prestataire et rapporte l'issue. « Versé » veut dire « accepté par le prestataire sur
// le compte du coach » ; le virement de ce compte vers sa banque est fait par le prestataire.
import { type ClientPostgres, codeMetier } from './postgres.ts';
import { reponseJson } from './http.ts';
import { reponseRefus } from './refus.ts';
import { ErreurPassagere } from './session-paiement.ts';

// Ce que le prestataire répond à un virement.
//   accepte  : le virement existe, sous cette référence ;
//   refuse   : il ne se fera jamais tel quel (compte fermé, destination invalide) ;
//   reporte  : pas maintenant (fonds de la plateforme pas encore disponibles) — on réessaiera.
export type IssueVirement =
  | { issue: 'accepte'; reference: string }
  | { issue: 'refuse'; motif: string }
  | { issue: 'reporte'; motif: string };

export type PrestataireVersements = {
  // Une clé par versement : relancé, le même versement ne part jamais deux fois. Le
  // prestataire cherche d'abord un virement déjà fait pour ce versement (une clé d'idempotence
  // ne vit que vingt-quatre heures, la tâche repasse le lendemain).
  virer(demande: {
    versementId: string;
    montantCentimes: number;
    compte: string;
  }): Promise<IssueVirement>;
};

export type IssueVersement = {
  versement: string;
  issue: 'verse' | 'echoue' | 'reporte' | 'erreur';
  detail: string | null;
};

type AExecuter = {
  versement_id: string;
  montant_centimes: number;
  reference_compte_prestataire: string;
};

async function rpc(serveur: ClientPostgres, fonction: string, args: Record<string, unknown>) {
  const { data, error } = await serveur.rpc(fonction, args);
  if (error) throw new ErreurPassagere(codeMetier(error) ?? `${fonction}_echouee`);
  return data;
}

export async function executerUnVersement(
  serveur: ClientPostgres,
  prestataire: PrestataireVersements,
  v: AExecuter,
): Promise<IssueVersement> {
  try {
    const issue = await prestataire.virer({
      versementId: v.versement_id,
      montantCentimes: v.montant_centimes,
      compte: v.reference_compte_prestataire,
    });
    if (issue.issue === 'reporte') {
      return { versement: v.versement_id, issue: 'reporte', detail: issue.motif };
    }
    if (issue.issue === 'refuse') {
      await rpc(serveur, 'conclure_versement', {
        p_versement_id: v.versement_id,
        p_reussi: false,
        p_motif: issue.motif,
      });
      return { versement: v.versement_id, issue: 'echoue', detail: issue.motif };
    }
    await rpc(serveur, 'poser_versement_en_cours', {
      p_versement_id: v.versement_id,
      p_reference: issue.reference,
    });
    await rpc(serveur, 'conclure_versement', { p_versement_id: v.versement_id, p_reussi: true });
    return { versement: v.versement_id, issue: 'verse', detail: null };
  } catch (erreur) {
    // Une panne (réseau, base) : le versement reste prévu, la tâche du lendemain le reprend.
    const detail = erreur instanceof ErreurPassagere ? erreur.message : 'prestataire_injoignable';
    return { versement: v.versement_id, issue: 'erreur', detail };
  }
}

// La part « versements » de la tâche du matin : les versements du mois (le 5 seulement, la base
// le sait), puis chaque versement prévu, l'un après l'autre. Un échec n'arrête pas les suivants.
export async function executerVersements(
  serveur: ClientPostgres,
  prestataire: PrestataireVersements,
  jour: string,
): Promise<{ crees: number; versements: IssueVersement[] }> {
  const crees = (await rpc(serveur, 'creer_versements_mensuels', { p_jour: jour })) as number;
  const aExecuter = ((await rpc(serveur, 'versements_a_executer', {})) ?? []) as AExecuter[];
  const versements: IssueVersement[] = [];
  for (const v of aExecuter) versements.push(await executerUnVersement(serveur, prestataire, v));
  return { crees, versements };
}

// POST /coach-versements : la demande immédiate du coach. La base décide sous SON jeton (0074) ;
// le virement part tout de suite, sans attendre le lendemain.
const REFUS_VERSEMENT: Record<
  string,
  {
    code:
      | 'solde_insuffisant'
      | 'compte_versement_non_operationnel'
      | 'versement_deja_en_cours'
      | 'profil_coach_requis';
    statut: number;
  }
> = {
  solde_insuffisant: { code: 'solde_insuffisant', statut: 409 },
  compte_versement_non_operationnel: { code: 'compte_versement_non_operationnel', statut: 409 },
  versement_deja_en_cours: { code: 'versement_deja_en_cours', statut: 409 },
  profil_coach_requis: { code: 'profil_coach_requis', statut: 403 },
};

export async function demanderVersementImmediat(
  duCoach: ClientPostgres,
  serveur: ClientPostgres,
  prestataire: PrestataireVersements,
): Promise<Response> {
  const { data, error } = await duCoach.rpc('demander_versement_immediat', {});
  if (error) {
    if ((error as { code?: string }).code === '42501') return reponseRefus(401, 'non_authentifie');
    const code = codeMetier(error);
    const refus = code === null ? undefined : REFUS_VERSEMENT[code];
    if (refus) return reponseRefus(refus.statut, refus.code);
    throw new ErreurPassagere(code ?? 'versement_non_demande');
  }
  const versementId = data as string;
  const aExecuter = ((await rpc(serveur, 'versements_a_executer', {})) ?? []) as AExecuter[];
  const v = aExecuter.find((x) => x.versement_id === versementId);
  // Introuvable parmi les prévus : déjà parti (un autre passage l'a pris) — rien à refaire.
  const issue = v ? await executerUnVersement(serveur, prestataire, v) : null;
  // Le coach lit l'état réel du versement : versé, échoué, ou prévu (reporté, réessayé demain).
  const etat =
    issue === null
      ? 'en_cours'
      : issue.issue === 'verse'
        ? 'verse'
        : issue.issue === 'echoue'
          ? 'echoue'
          : 'prevu';
  return reponseJson(201, { versementId, statut: etat });
}
