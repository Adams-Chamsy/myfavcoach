// Retraitement des anomalies de paiement ouvertes (0040), appelé par l'Edge Function
// anomalies-retraitement.
//
// Une anomalie répond 200 au prestataire, qui ne relivre donc pas (docs/backend.md §12). Quand elle
// vient d'un défaut de NOTRE code, ce module la rattrape une fois le défaut corrigé : il relit la
// session chez Stripe et lui applique LE MÊME traitement que le webhook et le constat
// (session-paiement.ts). L'information n'est jamais dans l'événement : elle est dans la session.
//
// Sans identifiant d'événement, la synchronisation suit le chemin du constat. Elle reste sûre si
// on la rejoue : un abonnement par référence de paiement, une confirmation ou un rejet seulement
// depuis en_attente_confirmation (0037). Deux retraitements simultanés ne facturent pas deux fois,
// et resoudre_anomalie_paiement ne marque l'anomalie qu'une fois.
import { type ClientPostgres } from './postgres.ts';
import { ErreurPassagere, synchroniserSession } from './session-paiement.ts';
import { type Stripe } from './stripe.ts';

export type Bilan = {
  anomalie: string;
  session: string;
  motif: string;
  issue: 'resolue' | 'ouverte';
  detail: string;
};

// L'appelant n'a pas le droit de lister les anomalies : Postgres l'a refusé (0040, rôle du serveur
// seul). Le point d'entrée répond 403.
export class RefusAppelant extends Error {}

type Ouverte = { id: string; session_prestataire: string; motif: string };

// Les seules issues qui règlent l'anomalie : la session a été traitée (abonnement créé, confirmé
// ou rejeté selon l'état réel), ou elle a expiré sans paiement. Tout le reste la laisse ouverte,
// avec la raison dans le bilan.
const ISSUES_RESOLUES = ['abonne', 'expiree'];

const PERMISSION_REFUSEE = '42501';

export async function retraiterAnomalies(
  appelant: ClientPostgres,
  serveur: ClientPostgres,
  relire: (idSession: string) => Promise<Stripe.Checkout.Session>,
  session: string | null,
): Promise<Bilan[]> {
  // Avec le jeton de l'APPELANT : c'est cette lecture qui refuse quiconque n'est pas le serveur.
  const { data, error } = await appelant.rpc('anomalies_paiement_ouvertes');
  if (error) {
    if ((error as { code?: string }).code === PERMISSION_REFUSEE) throw new RefusAppelant();
    throw new ErreurPassagere('anomalies_illisibles');
  }
  const ouvertes = (data as Ouverte[]).filter(
    (a) => session === null || a.session_prestataire === session,
  );

  const bilan: Bilan[] = [];
  // Une à une, dans l'ordre de constat : une erreur sur l'une n'arrête pas les suivantes.
  for (const a of ouvertes) {
    const ligne = { anomalie: a.id, session: a.session_prestataire, motif: a.motif };
    try {
      const relue = await relire(a.session_prestataire);
      const synchronisation = await synchroniserSession(serveur, relue, null);
      if (
        synchronisation.type === 'resultat' &&
        ISSUES_RESOLUES.includes(synchronisation.resultat)
      ) {
        const resolue = await serveur.rpc('resoudre_anomalie_paiement', {
          p_id: a.id,
          p_resolution: synchronisation.resultat,
        });
        if (resolue.error) throw new ErreurPassagere('resolution_impossible');
        bilan.push({ ...ligne, issue: 'resolue', detail: synchronisation.resultat });
      } else {
        const detail =
          synchronisation.type === 'resultat'
            ? `resultat:${synchronisation.resultat}`
            : synchronisation.type === 'incoherence'
              ? `incoherence:${synchronisation.motif}`
              : 'session_sans_intention';
        bilan.push({ ...ligne, issue: 'ouverte', detail });
      }
    } catch (erreur) {
      const code = erreur instanceof ErreurPassagere ? erreur.message : 'relecture_impossible';
      bilan.push({ ...ligne, issue: 'ouverte', detail: code });
    }
  }
  return bilan;
}
