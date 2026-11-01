// POST /functions/v1/echeances-quotidiennes -- appelée chaque matin par la tâche planifiée
// (pg_cron + pg_net, 0047), jamais par l'application. P4.8b (docs/prompts/L4.md).
//
// Déployée SANS vérification de jeton Supabase (supabase/config.toml) : la tâche planifiée n'en a
// pas. Ce qui la protège : l'en-tête x-cle-tache, comparé à CLE_TACHE_PLANIFIEE avant toute
// action — sans lui, n'importe qui pourrait déclencher des prélèvements.
//
// Corps facultatif : { "jour": "AAAA-MM-JJ" } — le jour traité, pour rattraper un matin manqué ou
// pour l'essai de P4.8b. Par défaut : aujourd'hui, Europe/Paris.
//
// Le bilan ne porte que des identifiants et des issues : jamais un moyen de paiement, un client
// Stripe ni une donnée personnelle (CLAUDE.md §10).
import { ConfigurationIncomplete, lireSecret } from '../_partage/environnement.ts';
import { reponseCode, reponseJson } from '../_partage/http.ts';
import { executerJournee } from '../_partage/prelevement.ts';
import { clientServeur } from '../_partage/postgres.ts';
import { prestataireStripe } from '../_partage/prestataire-stripe.ts';
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

async function traiter(requete: Request): Promise<Response> {
  if (requete.method !== 'POST') return reponseCode(405, 'methode_interdite');
  const cle = requete.headers.get('x-cle-tache') ?? '';
  if (!memeCle(cle, lireSecret('CLE_TACHE_PLANIFIEE'))) {
    return reponseCode(401, 'non_autorise');
  }
  let jour = aujourdhuiParis();
  const texte = await requete.text();
  if (texte.trim() !== '') {
    try {
      const demande = (JSON.parse(texte) as { jour?: unknown }).jour;
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
  const bilan = await executerJournee(clientServeur(), prestataireStripe(clientStripe()), jour);
  return reponseJson(200, bilan);
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
