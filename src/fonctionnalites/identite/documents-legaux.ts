// L2-03 (C-06). Quatre documents contractuels ; aucun n'a de texte réel à ce jour (dépend d'un
// juriste, docs/perimetre.md §6 — non rédigé). La fiche interdit tout texte de remplissage
// inventé pour l'occasion (« Aucun texte inventé ») : TEXTES_DOCUMENTS n'affiche donc qu'un avis
// honnête sur cette absence, jamais une prose qui se ferait passer pour un vrai texte légal.
export type TypeDocumentLegal = 'cgu' | 'cgv' | 'confidentialite' | 'contrat-coach';

export const TITRES_DOCUMENTS: Record<TypeDocumentLegal, string> = {
  cgu: "Conditions générales d'utilisation",
  cgv: 'Conditions générales de vente',
  confidentialite: 'Politique de confidentialité',
  'contrat-coach': 'Contrat coach',
};

// Duplique volontairement VERSION_CGU_ACCEPTEE (src/services/auth/supabase.ts), la seule
// valeur réellement écrite à l'inscription : un adaptateur ne s'importe jamais depuis un écran
// (CLAUDE.md §2), donc pas de source unique possible ici sans changer la signature de
// PortAuth.inscrire pour lui faire accepter une version en paramètre (comme
// enregistrerConsentementSante) — hors périmètre de ce prompt. Une divergence entre les deux
// ferait mentir le bandeau « Une version a changé » dès la prochaine inscription : à surveiller
// manuellement tant que ces deux constantes existent séparément (docs/dette.md).
export const VERSION_CGU_ACCEPTEE = '2026-09-04';

// CGV n'a aucune colonne d'acceptation distincte dans `comptes` : la fiche ne demande qu'une
// ligne « toujours » par document, sans nouvelle colonne. Traité comme accepté en même temps
// que les CGU, sous la même version — docs/dette.md.
export const VERSION_CGV_ACCEPTEE = VERSION_CGU_ACCEPTEE;

// Confidentialité et contrat coach : aucune acceptation n'est tracée nulle part pour ces deux
// documents (docs/domaine.md §3.12 ne liste que donneesSante/notificationsPush/
// communicationsCommerciales comme types de consentement) — ces deux versions ne sont que la
// date du contenu affiché, jamais une date d'acceptation, d'où « mise à jour le » plutôt
// qu'« acceptée le » dans l'écran authentifié.
export const VERSION_CONFIDENTIALITE = '2026-09-04';
export const VERSION_CONTRAT_COACH = '2026-09-04';

export const VERSIONS_DOCUMENTS: Record<TypeDocumentLegal, string> = {
  cgu: VERSION_CGU_ACCEPTEE,
  cgv: VERSION_CGV_ACCEPTEE,
  confidentialite: VERSION_CONFIDENTIALITE,
  'contrat-coach': VERSION_CONTRAT_COACH,
};

export const TEXTES_DOCUMENTS: Record<TypeDocumentLegal, string> = {
  cgu: "Le texte réel des conditions générales d'utilisation n'est pas encore rédigé (dépend d'un juriste, docs/perimetre.md §6). Cette page existe pour que le lien fonctionne ; le contenu sera publié avant la mise en production.",
  cgv: "Le texte réel des conditions générales de vente n'est pas encore rédigé (dépend d'un juriste, docs/perimetre.md §6). Cette page existe pour que le lien fonctionne ; le contenu sera publié avant la mise en production.",
  confidentialite:
    "Le texte réel de la politique de confidentialité n'est pas encore rédigé (dépend d'un juriste, docs/perimetre.md §6). Cette page existe pour que le lien fonctionne ; le contenu sera publié avant la mise en production.",
  'contrat-coach':
    "Le texte réel du contrat coach n'est pas encore rédigé (dépend d'un juriste, docs/perimetre.md §6). Cette page existe pour que le lien fonctionne ; le contenu sera publié avant la mise en production.",
};

export function formaterVersionDocument(version: string): string {
  const [annee, mois, jour] = version.split('-');
  return annee && mois && jour ? `${jour}/${mois}/${annee}` : version;
}
