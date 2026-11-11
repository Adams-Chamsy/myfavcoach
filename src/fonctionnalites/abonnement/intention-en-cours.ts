import type { ResultatIntention } from '@/services/donnees/port';

// P4.6b — le passage de 04a à 04b. L'URL de paiement ne voyage jamais dans une adresse, un journal
// ni un stockage (CLAUDE.md §10, docs/ecrans/L4-04b-recapitulatif-paiement.md, critère 10) : elle
// reste en mémoire, dans ce module, le temps du tunnel. Application tuée en plein paiement : la
// mémoire est perdue, et c'est voulu (fiche 04b, « Ce qui a été inventé ») — le webhook crée
// l'abonnement de toute façon, la personne le voit dans 24b à la prochaine ouverture.

export type IntentionCreee = Extract<ResultatIntention, { issue: 'creee' }>;

export type IntentionEnCours = {
  intention: IntentionCreee;
  // Ce que 04a a choisi et que le récapitulatif nomme (fiche 04b, « Titre de l'offre, coach ·
  // discipline »). Le serveur ne le rend pas avec l'intention.
  offre: { id: string; titre: string };
  coach: { id: string; prenom: string; nom: string; discipline: string };
  // Heure de création, pour la page expirée (30 minutes, docs/api.md §7).
  creeeLe: number;
};

let enCours: IntentionEnCours | null = null;

export function poserIntentionEnCours(valeur: IntentionEnCours): void {
  enCours = valeur;
}

export function lireIntentionEnCours(): IntentionEnCours | null {
  return enCours;
}

export function oublierIntentionEnCours(): void {
  enCours = null;
}
