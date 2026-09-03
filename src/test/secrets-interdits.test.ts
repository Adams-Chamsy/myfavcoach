import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, relative } from 'path';

// Preuve par balayage de fichiers, pas par une règle de configuration. Au lot L0, une liste
// d'exclusion ne protégeait rien parce que personne n'avait tenté l'interdit dans un test.
const RACINE_DEPOT = join(__dirname, '..', '..');
const CE_FICHIER = relative(RACINE_DEPOT, __filename);

// --cached (deja suivis) + --others --exclude-standard (nouveaux fichiers, pas encore
// `git add`, mais pas ignores non plus) : un fichier tout juste ecrit et pas encore mis en
// scene doit etre balaye comme les autres, avant meme le premier commit qui le suivra
// reellement. Seul --exclude-standard (donc .gitignore) decide qu'un fichier est hors de
// portee — jamais le hasard d'un `git add` pas encore fait.
function fichiersSuivisParGit(): string[] {
  const sortie = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: RACINE_DEPOT,
    encoding: 'utf8',
  });
  return sortie
    .split('\n')
    .filter(Boolean)
    .filter((chemin) => chemin !== CE_FICHIER);
}

function contenuDe(chemins: string[]): { chemin: string; contenu: string }[] {
  return chemins.map((chemin) => ({
    chemin,
    contenu: readFileSync(join(RACINE_DEPOT, chemin), 'utf8'),
  }));
}

// Fonction pure, sans lecture disque : c'est elle que les tests "le balayage sait détecter"
// exercent directement, avec un contenu écrit exprès plutôt qu'un vrai fichier temporaire.
function coupables(fichiers: { chemin: string; contenu: string }[], motif: RegExp): string[] {
  return fichiers.filter((f) => motif.test(f.contenu)).map((f) => f.chemin);
}

describe('secrets interdits côté application', () => {
  // Le balayage doit pouvoir échouer : ces trois tests exercent la fonction de détection avec
  // un contenu écrit exprès, avant de lui faire confiance pour dire "rien trouvé" sur le vrai
  // dépôt ci-dessous. Sans eux, un balayage qui ne balaie rien passerait toujours.
  describe('le balayage se prouve lui-même capable de détecter', () => {
    it('trouve "stripe" dans un contenu écrit exprès pour le contenir', () => {
      const trouves = coupables(
        [{ chemin: 'poison.ts', contenu: "import Stripe from 'stripe';" }],
        /stripe/i,
      );
      expect(trouves).toEqual(['poison.ts']);
    });

    it('trouve "service_role" dans un contenu écrit exprès pour le contenir', () => {
      const trouves = coupables(
        [{ chemin: 'poison.env', contenu: 'SUPABASE_SERVICE_ROLE_KEY=abc' }],
        /service_role/i,
      );
      expect(trouves).toEqual(['poison.env']);
    });

    it('ne trouve rien dans un contenu propre', () => {
      const propre = [{ chemin: 'propre.ts', contenu: "export const x = 'rien ici';" }];
      expect(coupables(propre, /stripe/i)).toEqual([]);
      expect(coupables(propre, /service_role/i)).toEqual([]);
    });
  });

  // Portée : src/, app/, scripts/, .github/workflows/, plus app.config.js et app.json s'ils
  // existent — les endroits réels où une clé Stripe se glisserait, pas seulement les
  // composants. docs/backend.md §5 : la clé publiable de Stripe n'a rien à faire dans le code
  // tant que l'intégration n'est pas construite, au lot L4.
  describe('Stripe', () => {
    const PREFIXES = ['src/', 'app/', 'scripts/', '.github/workflows/'];
    const FICHIERS_EXACTS = new Set(['app.config.js', 'app.json']);
    const fichiers = contenuDe(
      fichiersSuivisParGit().filter(
        (chemin) =>
          PREFIXES.some((prefixe) => chemin.startsWith(prefixe)) || FICHIERS_EXACTS.has(chemin),
      ),
    );

    it('aucun fichier n\'importe un module "stripe"', () => {
      expect(coupables(fichiers, /stripe/i)).toEqual([]);
    });

    it('aucun fichier ne lit EXPO_PUBLIC_STRIPE_PK', () => {
      expect(coupables(fichiers, /EXPO_PUBLIC_STRIPE_PK/)).toEqual([]);
    });
  });

  // Portée : tout le dépôt suivi par git — une clé de service ne se glisse pas dans un
  // composant, elle atterrit dans un script, une config de build ou un fichier de CI. Se
  // limiter aux fichiers suivis par git exclut .env automatiquement : ce qui n'est pas suivi
  // ne peut pas fuir par le dépôt.
  //
  // Chaque exception est nommée une par une : ajouter une clé ici est un choix humain, jamais
  // un motif générique qui laisserait passer un dixième fichier sans que personne le décide.
  // Les neuf ci-dessous nomment "service_role" pour avertir qu'elle est interdite, ou l'utilisent
  // légitimement côté outillage de test ou de migration (jamais dans l'application) — la doc
  // qui nomme le danger n'est pas le danger :
  //   - .env.exemple                                 : le commentaire qui explique le préfixe EXPO_PUBLIC_
  //   - CLAUDE.md                                     : §2, la règle elle-même
  //   - docs/backend.md                               : §6, "ce qui ne quitte jamais le serveur"
  //   - docs/prompts/L1.md                            : historique du prompt qui a posé cette règle
  //   - eslint.config.js                              : le motif de la règle ESLint qui interdit la chaîne dans le code
  //   - supabase/migrations/0001_creer_identite.sql   : commentaires expliquant pourquoi aucun grant n'est posé pour ce rôle
  //   - supabase/migrations/0003_accorder_service_role.sql : corrige cette hypothèse — les GRANT que ce rôle nécessite réellement sur ce projet, justifiés ligne à ligne
  //   - supabase/config.toml                          : commentaire généré par `supabase init`, décrivant les rôles de la Data API
  //   - src/test/rls.banc.ts                          : le nom de variable (SERVICE_ROLE_KEY) apparaît pour préparer le banc ; sa valeur, jamais écrite ici, est lue depuis .env.test.local (ignoré par git) — jamais dans l'application
  describe('clé service_role', () => {
    const EXCEPTIONS = new Set([
      '.env.exemple',
      'CLAUDE.md',
      'docs/backend.md',
      'docs/prompts/L1.md',
      'eslint.config.js',
      'supabase/migrations/0001_creer_identite.sql',
      'supabase/migrations/0003_accorder_service_role.sql',
      'supabase/config.toml',
      'src/test/rls.banc.ts',
    ]);
    const fichiers = contenuDe(fichiersSuivisParGit().filter((chemin) => !EXCEPTIONS.has(chemin)));

    it('aucun fichier suivi par git (hors exceptions nommées) ne contient "service_role"', () => {
      expect(coupables(fichiers, /service_role/i)).toEqual([]);
    });
  });
});
