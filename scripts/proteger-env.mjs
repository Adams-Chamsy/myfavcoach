// Rend .env en LECTURE SEULE (chmod 444) — garde mécanique contre l'incident qui a motivé ce
// script : un agent a exécuté `cp .env.exemple .env`, écrasant un .env réel sans le relire
// d'abord (CLAUDE.md §4 l'interdit désormais explicitement, mais une règle écrite ne protège
// rien tant qu'aucun mécanisme ne la fait échouer pour de vrai — même principe que tout balayage
// de ce dépôt, docs/prompts/L1.md, tableau des faux verts).
//
// Une fois .env à 444, un `cp`/`> .env`/redirection shell échoue avec "Permission denied" tant
// que personne n'a explicitement rendu le fichier réinscriptible (`chmod +w .env`) — geste
// délibéré, plus difficile à faire par accident qu'un écrasement silencieux. NE PROTÈGE PAS
// contre `rm .env` suivi d'une recréation : supprimer un fichier ne dépend que des droits du
// DOSSIER, jamais de ceux du fichier lui-même. C'est un frein, pas une garantie absolue — dit
// franchement, pas présenté comme plus solide qu'il ne l'est.
//
// Aucun effet sur .env.exemple (suivi par git, doit rester modifiable normalement) ni sur la CI
// (qui écrit un .env de substitution dans un clone qui n'en a PAS encore un : créer un fichier
// n'exige aucun droit sur un fichier qui n'existe pas encore).
import { chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CHEMIN_ENV = join(new URL('..', import.meta.url).pathname, '.env');

if (!existsSync(CHEMIN_ENV)) {
  console.log(
    '[proteger-env] .env absent — rien à protéger. Crée-le à la main, puis relance ce script.',
  );
  process.exit(0);
}

chmodSync(CHEMIN_ENV, 0o444);
console.log(
  '[proteger-env] .env passé en lecture seule (chmod 444). `chmod +w .env` pour le modifier volontairement.',
);
