// Neutralise `console.*` dans un build de PRODUCTION.
//
// docs/ecrans/L1-05-onboarding-client.md, critère 5 ; CLAUDE.md §10 : le poids est une donnée
// de catégorie 9 RGPD, elle ne doit jamais atteindre une sortie de journalisation. Un
// `console.log(erreur)` ou `console.error(reponse)` où l'objet porte un corps de requête (le
// poids en fait partie) imprimerait cette donnée dans le journal système de l'appareil. En
// développement c'est utile ; sur l'appareil d'un utilisateur, non — et personne ne lit ce
// journal de toute façon.
//
// Substitution directe, aucune dépendance (pas de lib de logging). Appelée une seule fois, au
// chargement de app/_layout.tsx, avant tout rendu.
//
// Quand un outil de rapport de plantage sera ajouté (aucun aujourd'hui —
// src/test/donnees-sante-hors-journal.test.ts le vérifie) : il devra soit être câblé AVANT
// cet appel et configuré pour retirer les corps de requête, soit être exempté ici
// explicitement.
const METHODES = [
  'log',
  'debug',
  'info',
  'warn',
  'error',
  'trace',
  'dir',
  'table',
  'group',
  'groupCollapsed',
  'groupEnd',
] as const;

export function neutraliserConsoleEnProduction(estDeveloppement: boolean = __DEV__): void {
  if (estDeveloppement) return;
  const inerte = (): void => {};
  for (const methode of METHODES) {
    if (typeof console[methode] === 'function') {
      console[methode] = inerte;
    }
  }
}
