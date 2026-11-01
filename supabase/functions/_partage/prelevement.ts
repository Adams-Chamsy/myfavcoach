// Le prélèvement d'une échéance hors session, et sa conclusion (P4.8b ; docs/domaine.md §4.4,
// docs/backend.md « Pas de Stripe Billing »). Les règles vivent en base (0044) : ce module ne
// décide rien, il appelle le prestataire et rapporte son issue à ouvrir_tentative et
// conclure_tentative.
//
// Le prestataire est passé en paramètre (`Prestataire`) : l'Edge Function lui donne le vrai
// client Stripe, les tests un faux. Aucun type Stripe ne sort d'ici.
import { type ClientPostgres, codeMetier } from './postgres.ts';
import { ErreurPassagere } from './session-paiement.ts';

export type MotifBanque =
  | 'fonds_insuffisants'
  | 'carte_expiree'
  | 'opposition'
  | 'plafond_atteint'
  | 'authentification_echouee'
  | 'inconnu';

// Traduction des refus bancaires, validée le 1er novembre 2026 (docs/prompts/L4.md, P4.8).
// « Jamais deviné » (docs/domaine.md §3.4bis) : un code absent de cette table donne `inconnu`.
// authentication_required n'est pas un échec d'authentification : la banque exige le client
// présent, impossible sur un prélèvement d'échéance — aucune des six valeurs ne le dit mieux ;
// l'écran 20 en tient compte (P4.7).
const MOTIFS: Record<string, MotifBanque> = {
  insufficient_funds: 'fonds_insuffisants',
  expired_card: 'carte_expiree',
  lost_card: 'opposition',
  stolen_card: 'opposition',
  pickup_card: 'opposition',
  debit_not_authorized: 'opposition',
  card_velocity_exceeded: 'plafond_atteint',
  withdrawal_count_limit_exceeded: 'plafond_atteint',
  authentication_required: 'authentification_echouee',
};

export function motifDuRefus(code: string | null | undefined): MotifBanque {
  return (code && MOTIFS[code]) || 'inconnu';
}

// Une ligne de echeances_a_prelever (0044).
export type Echeance = {
  abonnement_id: string;
  echeance_le: string;
  tentative_numero: number;
  montant_centimes: number;
};

// Ce que le prestataire rend d'un paiement : son identifiant, son statut, et le code du refus
// quand il y en a un (decline_code, sinon code — le plus précis d'abord).
export type PaiementPrestataire = { id: string; statut: string; codeRefus: string | null };

export type Prestataire = {
  // Rend le paiement créé, ACCEPTÉ OU REFUSÉ. Ne lève que si aucune réponse exploitable n'est
  // arrivée (réseau, panne, clé refusée) : l'échéance reste alors due, et le prochain essai,
  // sous la même clé, rend le même paiement.
  creerPaiement(
    demande: {
      montantCentimes: number;
      client: string;
      moyen: string;
      type: 'carte' | 'sepa';
      metadonnees: Record<string, string>;
    },
    cleIdempotence: string,
  ): Promise<PaiementPrestataire>;
};

export type IssuePrelevement = {
  abonnement: string;
  echeance: string;
  numero: number;
  issue: 'reussie' | 'echouee' | 'en_cours' | 'erreur';
  detail: string | null;
};

type ReferencesConservees = {
  reference_client_prestataire: string | null;
  reference_moyen_prestataire: string | null;
  moyen: 'carte' | 'sepa';
};

async function rpc(serveur: ClientPostgres, fonction: string, args: Record<string, unknown>) {
  const { error } = await serveur.rpc(fonction, args);
  if (error) throw new ErreurPassagere(codeMetier(error) ?? `${fonction}_echouee`);
}

async function ouvrirEtConclure(
  serveur: ClientPostgres,
  due: Echeance,
  jour: string,
  reference: string,
  issue: { reussie: true } | { reussie: false; motif: MotifBanque } | null,
) {
  await rpc(serveur, 'ouvrir_tentative', {
    p_abonnement_id: due.abonnement_id,
    p_echeance_le: due.echeance_le,
    p_tentative_numero: due.tentative_numero,
    p_reference: reference,
    p_jour: jour,
  });
  if (issue) {
    await rpc(serveur, 'conclure_tentative', {
      p_reference: reference,
      p_reussie: issue.reussie,
      p_motif: issue.reussie ? null : issue.motif,
    });
  }
}

export async function preleverEcheance(
  serveur: ClientPostgres,
  prestataire: Prestataire,
  due: Echeance,
  jour: string,
): Promise<IssuePrelevement> {
  const ligne = {
    abonnement: due.abonnement_id,
    echeance: due.echeance_le,
    numero: due.tentative_numero,
  };
  try {
    const { data, error } = await serveur
      .from('abonnements')
      .select('reference_client_prestataire,reference_moyen_prestataire,moyen')
      .eq('id', due.abonnement_id)
      .maybeSingle<ReferencesConservees>();
    if (error || !data) throw new ErreurPassagere('abonnement_illisible');

    // Aucun moyen conservé (abonnement antérieur à 0046, ou client Stripe absent) : rien à
    // prélever. L'échéance ÉCHOUE, motif inconnu, sous une référence qui le dit : la machine
    // avance (impayé, relances, suspension) au lieu de rester due chaque matin pour toujours.
    if (!data.reference_client_prestataire || !data.reference_moyen_prestataire) {
      const reference = `sans-moyen-${due.abonnement_id}-${due.echeance_le}-${due.tentative_numero}`;
      await ouvrirEtConclure(serveur, due, jour, reference, { reussie: false, motif: 'inconnu' });
      return { ...ligne, issue: 'echouee', detail: 'inconnu' };
    }

    const paiement = await prestataire.creerPaiement(
      {
        montantCentimes: due.montant_centimes,
        client: data.reference_client_prestataire,
        moyen: data.reference_moyen_prestataire,
        type: data.moyen,
        metadonnees: {
          abonnement_id: due.abonnement_id,
          echeance_le: due.echeance_le,
          tentative_numero: String(due.tentative_numero),
        },
      },
      // Une clé par tentative : jamais deux prélèvements pour la même tentative, même si la
      // tâche est relancée ou si la réponse s'est perdue en route.
      `echeance-${due.abonnement_id}-${due.echeance_le}-${due.tentative_numero}`,
    );

    if (paiement.statut === 'succeeded') {
      await ouvrirEtConclure(serveur, due, jour, paiement.id, { reussie: true });
      return { ...ligne, issue: 'reussie', detail: null };
    }
    if (paiement.statut === 'processing') {
      // Prélèvement SEPA : la banque répondra dans quelques jours, par le webhook.
      await ouvrirEtConclure(serveur, due, jour, paiement.id, null);
      return { ...ligne, issue: 'en_cours', detail: null };
    }
    const motif = motifDuRefus(paiement.codeRefus);
    await ouvrirEtConclure(serveur, due, jour, paiement.id, { reussie: false, motif });
    return { ...ligne, issue: 'echouee', detail: motif };
  } catch (erreur) {
    const detail = erreur instanceof ErreurPassagere ? erreur.message : 'prestataire_injoignable';
    return { ...ligne, issue: 'erreur', detail };
  }
}

// Le webhook (payment_intent.succeeded / payment_failed) : le paiement, relu chez Stripe, conclut
// SA tentative. Un paiement sans métadonnées d'échéance n'est pas à nous ici (celui de la page de
// paiement, traité par la session). Une tentative pas encore ouverte (l'événement a doublé la
// tâche) lève : 5xx, relivré, et la relivraison la trouvera.
export async function conclureDepuisPaiement(
  serveur: ClientPostgres,
  paiement: PaiementPrestataire & { metadonnees: Record<string, string> },
): Promise<'conclue' | 'hors_echeance' | 'en_attente'> {
  if (!paiement.metadonnees.abonnement_id || !paiement.metadonnees.echeance_le) {
    return 'hors_echeance';
  }
  if (paiement.statut === 'processing') return 'en_attente';
  const reussie = paiement.statut === 'succeeded';
  await rpc(serveur, 'conclure_tentative', {
    p_reference: paiement.id,
    p_reussie: reussie,
    p_motif: reussie ? null : motifDuRefus(paiement.codeRefus),
  });
  return 'conclue';
}

// La tâche planifiée, un jour donné (docs/prompts/L4.md, P4.8b) : les transitions du calendrier
// D'ABORD — une pause qui se termine ce jour-là ouvre son cycle par un prélèvement le jour même
// (docs/domaine.md §4.3) —, puis chaque échéance due, l'une après l'autre. Une échéance qui échoue
// à se prélever n'arrête pas les suivantes : son issue est au bilan.
export async function executerJournee(
  serveur: ClientPostgres,
  prestataire: Prestataire,
  jour: string,
): Promise<{ jour: string; transitions: unknown; prelevements: IssuePrelevement[] }> {
  const transitions = await serveur.rpc('appliquer_echeances', { p_jour: jour });
  if (transitions.error) throw new ErreurPassagere('transitions_impossibles');
  const dues = await serveur.rpc('echeances_a_prelever', { p_jour: jour });
  if (dues.error) throw new ErreurPassagere('echeances_illisibles');
  const prelevements: IssuePrelevement[] = [];
  for (const due of dues.data as Echeance[]) {
    prelevements.push(await preleverEcheance(serveur, prestataire, due, jour));
  }
  return { jour, transitions: transitions.data, prelevements };
}
