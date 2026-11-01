// Vérifie les Edge Functions (supabase/functions/) : deno check, deno lint, deno test. Appelé par
// npm run verif:fonctions, lui-même dans npm run verif.
//
// Pourquoi un script plutôt qu'une ligne de package.json : trouvé le 31 octobre 2026 (P4.5c),
// verif:fonctions n'était pas dans verif, et `deno` n'était pas dans le PATH du shell du
// développeur. Les tests Deno n'avaient donc jamais tourné à la porte d'entrée -- on se croyait
// couvert. Ce script :
//   - cherche deno dans le PATH, puis à l'emplacement de l'installateur officiel
//     (~/.deno/bin/deno, docs/backend.md §12, « Déploiement ») ;
//   - ÉCHOUE EN LE NOMMANT si deno est introuvable, au lieu de passer en silence.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossierFonctions = path.join(racine, 'supabase', 'functions');
const FONCTIONS = [
  'abonnement-intention/index.ts',
  'abonnement-constat/index.ts',
  'webhook-paiement/index.ts',
  'anomalies-retraitement/index.ts',
  'echeances-quotidiennes/index.ts',
];

function trouverDeno() {
  try {
    execFileSync('deno', ['--version'], { stdio: 'ignore' });
    return 'deno';
  } catch {
    const installe = path.join(homedir(), '.deno', 'bin', 'deno');
    return existsSync(installe) ? installe : null;
  }
}

const deno = trouverDeno();
if (deno === null) {
  console.error(
    '[verifier-fonctions] ECHEC — deno est introuvable (ni dans le PATH, ni dans ~/.deno/bin). ' +
      'Les tests des Edge Functions ne peuvent pas tourner : la vérification échoue plutôt que de ' +
      'les sauter en silence. Installer Deno par le binaire officiel (docs/backend.md §12).',
  );
  process.exit(1);
}

const etapes = [
  ['check', '--config', 'deno.jsonc', '--node-modules-dir=none', ...FONCTIONS],
  ['lint', '--config', 'deno.jsonc'],
  ['test', '--config', 'deno.jsonc', '--node-modules-dir=none', '--allow-env'],
];
for (const etape of etapes) {
  console.log(`[verifier-fonctions] deno ${etape[0]}`);
  const resultat = spawnSync(deno, etape, { cwd: dossierFonctions, stdio: 'inherit' });
  if (resultat.status !== 0) {
    console.error(`[verifier-fonctions] ECHEC — deno ${etape[0]}`);
    process.exit(resultat.status ?? 1);
  }
}
console.log('[verifier-fonctions] OK — check, lint, test');
