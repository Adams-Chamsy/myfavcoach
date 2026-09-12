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
// identifiante (supabase/migrations/0012_creer_pieces_verification.sql). Écrit en P2.5 comme un
// FIL-PIÈGE — RÈGLE 8 : la garde posée AVANT le code qui pourrait la violer, à un moment où
// aucun écran ne lisait encore chemin_stockage (P2.5 était backend seul).
//
// CE N'EST PLUS LE CAS : depuis P2.6/P2.10, `app/(onboarding)/devenir-coach-verification.tsx`
// (L2-06) ET `app/(admin)/verification.tsx` (L2-10) lisent tous deux chemin_stockage pour de
// vrai (dépôt du fichier, consultation par l'examinateur). Le 4ᵉ test ci-dessous n'est donc plus
// vacueusement vert : il scanne réellement ces deux fichiers à chaque exécution, et son passage
// prouve — pas suppose — qu'aucun des deux ne journalise ni ne construit d'URL avec cette
// colonne. Corrigé ici après l'avoir trouvé encore décrit comme vacueux pendant la revue de fin
// de lot L2 (porte de sortie, point 3) : un commentaire faux sur CE fichier précis coûte cher,
// puisque c'est lui qui protège la donnée la plus sensible du dépôt.
//
// S'il échoue un jour : c'est le signal d'écrire le scrubbing (console/rapport de plantage) ou
// de retirer la construction d'URL fautive, jamais de supprimer l'assertion.
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
  // Réellement exercé depuis P2.6/P2.10 (voir le commentaire d'en-tête) : L2-06 et L2-10 lisent
  // tous deux cette colonne, ce test les scanne donc pour de vrai à chaque exécution.
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
