// POST /functions/v1/echeances-quotidiennes -- appelée chaque matin par la tâche planifiée
// (pg_cron + pg_net, 0047), jamais par l'application. P4.8b (docs/prompts/L4.md).
//
// Déployée SANS vérification de jeton Supabase (supabase/config.toml) : la tâche planifiée n'en a
// pas. Ce qui la protège : l'en-tête x-cle-tache, comparé à CLE_TACHE_PLANIFIEE avant toute
// action — sans lui, n'importe qui pourrait déclencher des prélèvements.
//
// Corps facultatif : { "jour": "AAAA-MM-JJ", "rapprochementSeul": true } — le jour traité, pour rattraper un matin manqué ou
// pour l'essai de P4.8b. Par défaut : aujourd'hui, Europe/Paris.
//
// Le bilan ne porte que des identifiants et des issues : jamais un moyen de paiement, un client
// Stripe ni une donnée personnelle (CLAUDE.md §10).
import { ConfigurationIncomplete, lireSecret } from '../_partage/environnement.ts';
import { reponseCode, reponseJson } from '../_partage/http.ts';
import { executerJournee } from '../_partage/prelevement.ts';
import { clientServeur } from '../_partage/postgres.ts';
import {
  prestataireStripe,
  rapprochementStripe,
  versementsStripe,
} from '../_partage/prestataire-stripe.ts';
import { executerVersements } from '../_partage/versements.ts';
import {
  type BilanRapprochement,
  type Ecart,
  decalerJour,
  executerRapprochement,
} from '../_partage/rapprochement.ts';
import { ErreurPassagere } from '../_partage/session-paiement.ts';
import { clientStripe, descriptionErreurStripe } from '../_partage/stripe.ts';

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;

// Comparaison en temps constant : la durée de la réponse ne doit rien dire de la clé.
function memeCle(recue: string, attendue: string): boolean {
  const a = new TextEncoder().encode(recue);
  const b = new TextEncoder().encode(attendue);
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return difference === 0;
}

function aujourdhuiParis(): string {
  // fr-CA écrit les dates AAAA-MM-JJ.
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

function compterParClasse(ecarts: Ecart[]): Record<string, number> {
  const compte: Record<string, number> = {};
  for (const e of ecarts) compte[e.classe] = (compte[e.classe] ?? 0) + 1;
  return compte;
}

async function traiter(requete: Request): Promise<Response> {
  if (requete.method !== 'POST') return reponseCode(405, 'methode_interdite');
  const cle = requete.headers.get('x-cle-tache') ?? '';
  if (!memeCle(cle, lireSecret('CLE_TACHE_PLANIFIEE'))) {
    return reponseCode(401, 'non_autorise');
  }
  let jour = aujourdhuiParis();
  let rapprochementSeul = false;
  const texte = await requete.text();
  if (texte.trim() !== '') {
    try {
      const corps = JSON.parse(texte) as { jour?: unknown; rapprochementSeul?: unknown };
      rapprochementSeul = corps.rapprochementSeul === true;
      const demande = corps.jour;
      if (demande !== undefined) {
        if (typeof demande !== 'string' || !FORMAT_JOUR.test(demande)) {
          return reponseCode(400, 'jour_invalide');
        }
        jour = demande;
      }
    } catch {
      return reponseCode(400, 'corps_invalide');
    }
  }
  const serveur = clientServeur();
  const stripe = clientStripe();
  // Les prélèvements d'abord ; « rapprochementSeul » (rattrapage à la main, preuve de la porte de
  // sortie de L4) ne rejoue pas ceux du jour.
  const bilan = rapprochementSeul
    ? { jour }
    : await executerJournee(serveur, prestataireStripe(stripe), jour);

  // Puis les versements aux coachs (L5, P5.4b) : ceux du mois le 5, et tout versement prévu. Leur
  // échec ne défait rien des prélèvements ; il est dit au bilan.
  let versements: unknown = null;
  if (!rapprochementSeul) {
    try {
      versements = await executerVersements(serveur, versementsStripe(stripe), jour);
    } catch (erreur) {
      const code = erreur instanceof ErreurPassagere ? erreur.message : 'versements_impossibles';
      console.error(`echeances-quotidiennes : versements en échec, ${code}`);
      versements = { erreur: code };
    }
  }

  // Les factures de commission du mois écoulé (L5, P5.5) : la base n'émet que le 1er (0076).
  let facturesCommission: unknown = null;
  if (!rapprochementSeul) {
    const emises = await serveur.rpc('emettre_factures_commission', { p_jour: jour });
    if (emises.error) console.error('echeances-quotidiennes : factures de commission non émises');
    facturesCommission = emises.error ? { erreur: 'factures_commission_non_emises' } : emises.data;
  }

  // Puis le rapprochement (P4.11a) : les trois jours pleins qui précèdent — la nuit laisse au
  // webhook le temps d'arriver —, et le jour lui-même quand on ne fait que rapprocher. Son échec
  // ne défait rien de ce qui vient d'être prélevé : il est dit au bilan et au journal.
  let rapprochement: BilanRapprochement | { erreur: string };
  try {
    rapprochement = await executerRapprochement(
      serveur,
      rapprochementStripe(stripe),
      decalerJour(jour, -3),
      rapprochementSeul ? jour : decalerJour(jour, -1),
    );
    if (rapprochement.nouveaux > 0 || rapprochement.nonVerifiees > 0) {
      console.error(
        `echeances-quotidiennes : rapprochement, ${rapprochement.nouveaux} écart(s) nouveau(x), ` +
          `${rapprochement.nonVerifiees} facture(s) non vérifiée(s)`,
      );
    }
  } catch (erreur) {
    const code =
      erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'rapprochement_impossible');
    console.error(`echeances-quotidiennes : rapprochement en échec, ${code}`);
    rapprochement = { erreur: code };
  }
  // La réponse porte le compte par classe et les cinquante premiers écarts : la liste entière est
  // dans la table (ecarts_rapprochement), et la réponse d'une tâche planifiée reste petite.
  const resume =
    'erreur' in rapprochement
      ? rapprochement
      : {
          ...rapprochement,
          parClasse: compterParClasse(rapprochement.ecarts),
          ecarts: rapprochement.ecarts.slice(0, 50),
        };
  return reponseJson(200, { ...bilan, versements, facturesCommission, rapprochement: resume });
}

Deno.serve(async (requete) => {
  try {
    return await traiter(requete);
  } catch (erreur) {
    const code =
      erreur instanceof ConfigurationIncomplete || erreur instanceof ErreurPassagere
        ? erreur.message
        : (descriptionErreurStripe(erreur) ?? 'erreur_passagere');
    console.error(`echeances-quotidiennes : ${code}`);
    return reponseCode(500, 'erreur_passagere');
  }
});
