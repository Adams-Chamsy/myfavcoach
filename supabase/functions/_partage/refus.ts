// Les refus que l'application peut afficher : code, title, detail (docs/api.md §1, règle écrite
// le 31 octobre 2026). LA source unique de ces textes : un message d'erreur est un texte produit,
// pas un détail technique — s'il vivait dans chaque écran, il serait réécrit différemment dans
// chacun. L'écran affiche `title` et `detail` tels quels ; il branche son comportement sur `code`,
// jamais sur le texte.
//
// Registre : celui du tableau des messages de docs/ecrans/L1-02-creation-compte.md — tutoiement,
// factuel, pas de jargon, jamais un code technique à l'écran. Les réponses du webhook ne passent
// pas ici : elles sont lues par le prestataire, jamais par une personne.
import { ENTETES_CORS } from './http.ts';

export const TEXTES_REFUS = {
  // abonnement-intention
  offre_indisponible: {
    title: "Cette formule n'est plus proposée",
    detail: "Le coach l'a retirée entre-temps. Regarde ses autres formules sur son profil.",
  },
  coach_non_verifie: {
    title: "Ce coach n'accepte pas de nouvel abonnement",
    detail: "Rien n'a été débité. Tu pourras t'abonner quand ce sera de nouveau possible.",
  },
  auto_abonnement_interdit: {
    title: "Tu ne peux pas t'abonner à toi-même",
    detail: "C'est ton propre profil coach.",
  },
  deja_abonne: {
    title: 'Tu as déjà un abonnement avec ce coach',
    detail: "Rien n'a été débité. Tu le retrouves dans ton compte, rubrique Mes abonnements.",
  },
  profil_client_requis: {
    title: "Passe sur ton espace client pour t'abonner",
    detail: "L'abonnement se fait depuis ton profil client.",
  },
  requete_en_cours: {
    title: 'Ta demande est déjà en cours',
    detail: 'Encore un instant, on traite ta demande.',
  },
  cle_idempotence_reutilisee: {
    title: "Cette demande n'est plus valable",
    detail: 'Reviens au choix de la formule pour recommencer.',
  },
  cle_idempotence_requise: {
    title: 'Cette demande est incomplète',
    detail: 'Reviens au choix de la formule pour recommencer.',
  },
  corps_invalide: {
    title: 'Cette demande est incomplète',
    detail: 'Reviens au choix de la formule pour recommencer.',
  },
  // abonnement-constat
  intention_introuvable: {
    title: 'Ce paiement est introuvable',
    detail: 'Reviens au profil du coach pour recommencer.',
  },
  // avis (textes validés le 1er novembre 2026). « {n} jours » : le nombre vient du serveur
  // (0049, DETAIL de la levée), accordé par corpsRefus ; sans lui, detailSansNombre.
  avis_pas_encore: {
    title: "Pas encore d'avis possible",
    detail: 'Il te reste {n} jours de suivi avant de pouvoir donner ton avis.',
    detailSansNombre: 'Encore quelques jours de suivi avant de pouvoir donner ton avis.',
  },
  avis_suivi_interrompu: {
    title: "Pas d'avis pour le moment",
    detail: 'Tu pourras donner ton avis quand ton suivi aura repris.',
  },
  avis_impossible: {
    title: "Tu ne peux pas donner d'avis à ce coach",
    detail: 'Un avis se donne pendant ton suivi, ou dans les 60 jours après sa fin.',
  },
  avis_deja_donne: {
    title: 'Tu as déjà donné ton avis',
    detail: 'Tu peux le modifier pendant 14 jours après sa publication.',
  },
  avis_fige: {
    title: 'Cet avis ne peut plus être modifié',
    detail: 'Un avis se modifie pendant 14 jours après sa publication.',
  },
  avis_invalide: {
    title: "Ton avis n'a pas pu être enregistré",
    detail: 'Choisis une note, 3 étiquettes au plus, et un texte de 600 caractères au plus.',
  },
  // tous
  non_authentifie: {
    title: 'Ta session a expiré',
    detail: 'Reconnecte-toi pour continuer.',
  },
  methode_interdite: {
    title: "Cette demande n'est pas reconnue",
    detail: 'Reviens au choix de la formule pour recommencer.',
  },
  // Jamais « rien n'a été débité » ici : au constat, un paiement a pu aboutir.
  erreur_passagere: {
    title: 'On a un souci de notre côté',
    detail: "Ce n'est pas toi. Réessaie dans un instant.",
  },
} as const;

export type CodeRefus = keyof typeof TEXTES_REFUS;

export type CorpsRefus = { code: CodeRefus; title: string; detail: string; status: number };

// Un texte qui porte « {n} jours » reçoit le nombre rendu par le serveur, accordé (« 1 jour ») ;
// sans nombre utilisable, son texte de repli, sans chiffre.
function detailDe(code: CodeRefus, nombre: number | null): string {
  const texte: { detail: string; detailSansNombre?: string } = TEXTES_REFUS[code];
  if (!texte.detail.includes('{n} jours')) return texte.detail;
  if (nombre === null || !Number.isInteger(nombre) || nombre < 1) {
    return texte.detailSansNombre ?? texte.detail;
  }
  return texte.detail.replace('{n} jours', nombre === 1 ? '1 jour' : `${nombre} jours`);
}

export function corpsRefus(
  statut: number,
  code: CodeRefus,
  nombre: number | null = null,
): CorpsRefus {
  return {
    code,
    title: TEXTES_REFUS[code].title,
    detail: detailDe(code, nombre),
    status: statut,
  };
}

// application/problem+json (RFC 9457, docs/api.md §1). Les en-têtes CORS restent : l'application
// web appelle ces fonctions depuis une autre origine (_partage/http.ts).
export function reponseRefus(
  statut: number,
  code: CodeRefus,
  entetes: Record<string, string> = {},
  nombre: number | null = null,
): Response {
  return new Response(JSON.stringify(corpsRefus(statut, code, nombre)), {
    status: statut,
    headers: { 'Content-Type': 'application/problem+json', ...ENTETES_CORS, ...entetes },
  });
}

// Les refus MÉTIER de creer_intention_souscription (0037, 0043) et leur statut HTTP. Une levée
// absente de cette table n'est pas un refus : c'est une erreur, 5xx.
export const STATUTS_REFUS_INTENTION: Partial<Record<CodeRefus, number>> = {
  offre_indisponible: 409,
  coach_non_verifie: 409,
  auto_abonnement_interdit: 409,
  deja_abonne: 409,
  profil_client_requis: 403,
};

// Les refus MÉTIER des fonctions d'avis (0049) et leur statut HTTP, même principe.
export const STATUTS_REFUS_AVIS: Partial<Record<CodeRefus, number>> = {
  avis_pas_encore: 403,
  avis_suivi_interrompu: 403,
  avis_impossible: 403,
  avis_deja_donne: 409,
  avis_fige: 409,
  avis_invalide: 422,
  profil_client_requis: 403,
};
