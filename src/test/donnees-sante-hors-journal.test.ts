import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// docs/ecrans/L1-05-onboarding-client.md, critère 5 ; CLAUDE.md §10. La seule donnée de santé
// du lot L1 (poids_depart_grammes / poids_cible_grammes) ne doit atteindre ni un journal, ni
// un service de rapport de plantage. Trois garanties structurelles, en plus de son absence des
// URL (le port l'envoie dans le CORPS d'un PATCH, filtre = compte_id seul) et de son absence
// des traces d'erreur serveur (src/test/rls.banc.ts).
//
// Étendu en P2.5 (docs/prompts/L2.md) : pieces_verification.chemin_stockage rejoint cette
// garantie. Ce n'est pas une donnée de santé, mais son exposition serait pire — irréversible et
// identifiante (supabase/migrations/0012_creer_pieces_verification.sql). Aucun écran ne le lit
// encore (P2.5 est backend seul ; l'écran de dépôt arrive avec docs/ecrans/L2-06), donc le 4ᵉ
// test ci-dessous est aujourd'hui vacueusement vert — RÈGLE 8 : il reste écrit pour armer la
// garde AVANT le code qui pourrait la violer, même famille que le test 2 (aucun gestionnaire
// d'erreur global n'existe non plus aujourd'hui). Le jour où un écran lit chemin_stockage
// (jamais renvoyé par l'API de toute façon, voir le GRANT SELECT de la migration — seul un
// futur back-office y touchera), il ne devra jamais apparaître dans un console.*/rapport de
// plantage ni dans une URL de requête (paramètre de requête signée, log d'accès serveur) : ce
// test échouera alors pour de bon, et c'est le signal d'écrire le scrubbing plutôt que de
// supprimer l'assertion.
//
// FIL-PIÈGE VOLONTAIRE — le premier `it` ci-dessous échoue le jour où une dépendance de
// rapport de plantage (Sentry ou équivalent) entre dans package.json. Ce n'est PAS le signal
// de supprimer l'assertion : c'est le signal de prouver que l'outil est configuré pour retirer
// les corps de requête ET les champs `poids_*`/`chemin_stockage` de tout ce qu'il envoie
// (scrubbing / beforeSend / denyUrls selon l'outil), puis de remplacer cette assertion par la
// vérification de cette configuration. Retirer le test sans le remplacer rouvrirait un chemin
// de fuite d'une donnée de catégorie 9 RGPD ou d'une pièce d'identité, sans que rien ne le
// signale.
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

  // 4 · chemin_stockage (pieces_verification, P2.5) ne doit jamais atteindre un console.* ni
  // être assemblé dans une URL de requête (paramètre `?...chemin_stockage...` ou inversement).
  // Vert vacueux tant qu'aucun écran ne le lit (voir le commentaire d'en-tête) — armé pour le
  // jour où un écran de back-office/dépôt le fera.
  it('chemin_stockage n’apparaît dans aucun console.* ni construction d’URL, dans src/ ou app/', () => {
    const MOTIF_CONSOLE = /console\.[a-z]+\([^)]*chemin_stockage/i;
    // [?&] suivi d'une clef=valeur (un vrai paramètre de requête), jamais un simple "?." de
    // chaînage optionnel TypeScript — trouvé en écrivant ce test : `ligneB?.chemin_stockage`
    // (accès de propriété, aucun rapport avec une URL) faisait échouer un premier motif trop
    // large (`[?&][^...]*chemin_stockage`), qui ne distinguait pas les deux.
    const MOTIF_URL =
      /[?&][a-zA-Z_][a-zA-Z0-9_]*=[^`'"\n]*chemin_stockage|chemin_stockage[^`'"\n]*[?&][a-zA-Z_][a-zA-Z0-9_]*=/i;
    const coupables = fichiersSuivis(['src', 'app']).filter((c) => {
      const contenu = readFileSync(join(RACINE_DEPOT, c), 'utf8');
      return MOTIF_CONSOLE.test(contenu) || MOTIF_URL.test(contenu);
    });
    expect(coupables).toEqual([]);
  });
});
