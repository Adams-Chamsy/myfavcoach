import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// docs/ecrans/L1-05-onboarding-client.md, critère 5 ; CLAUDE.md §10. La seule donnée de santé
// du lot L1 (poids_depart_grammes / poids_cible_grammes) ne doit atteindre ni un journal, ni
// un service de rapport de plantage. Trois garanties structurelles, en plus de son absence des
// URL (le port l'envoie dans le CORPS d'un PATCH, filtre = compte_id seul) et de son absence
// des traces d'erreur serveur (src/test/rls.banc.ts).
const RACINE_DEPOT = join(__dirname, '..', '..');
const CE_FICHIER = join(__dirname, 'donnees-sante-hors-journal.test.ts');

function fichiersSuivis(prefixes: string[]): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', ...prefixes],
    {
      cwd: RACINE_DEPOT,
      encoding: 'utf8',
    },
  )
    .split('\n')
    .filter(Boolean)
    .filter((c) => /\.(tsx?|jsx?)$/.test(c))
    .filter((c) => !c.endsWith('.test.ts') && !c.endsWith('.test.tsx'))
    .filter((c) => join(RACINE_DEPOT, c) !== CE_FICHIER);
}

describe('la donnée de santé du lot n’atteint ni journal ni rapport de plantage', () => {
  // 1 · Aucun outil de rapport de plantage n'est installé. S'il en arrive un, il doit d'abord
  // être configuré pour retirer les corps de requête avant que cette liste soit élargie —
  // c'est un choix humain, pas un ajout silencieux.
  it('aucune dépendance de rapport de plantage / télémétrie', () => {
    const pkg = JSON.parse(readFileSync(join(RACINE_DEPOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const toutes = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const MOTIF =
      /sentry|bugsnag|crashlytics|firebase\/crash|rollbar|raygun|airbrake|honeybadger|instabug|datadog|newrelic|logrocket/i;
    expect(toutes.filter((nom) => MOTIF.test(nom))).toEqual([]);
  });

  // 2 · Aucun gestionnaire d'erreur global : ErrorUtils.setGlobalHandler / window.onerror /
  // 'unhandledrejection' sérialisent souvent tout le contexte (dont des corps de requête) vers
  // une destination. Aucun n'est posé dans le code livré ; en ajouter un = décision explicite.
  it('aucun gestionnaire d’erreur global dans src/ ou app/', () => {
    const MOTIF =
      /setGlobalHandler|onunhandledrejection|addEventListener\(\s*['"](error|unhandledrejection)['"]/;
    const coupables = fichiersSuivis(['src', 'app']).filter((c) =>
      MOTIF.test(readFileSync(join(RACINE_DEPOT, c), 'utf8')),
    );
    expect(coupables).toEqual([]);
  });

  // 3 · console.* est neutralisé en production, et le point d'entrée le câble. Le comportement
  // lui-même est prouvé par src/services/journalisation.test.ts ; ici on vérifie seulement que
  // app/_layout.tsx l'appelle bien (sinon la neutralisation n'aurait jamais lieu).
  it('app/_layout.tsx appelle neutraliserConsoleEnProduction au chargement du module', () => {
    const layout = readFileSync(join(RACINE_DEPOT, 'app/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/^neutraliserConsoleEnProduction\(\);/m);
  });
});
