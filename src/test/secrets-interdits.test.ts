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

// Un littéral chaîne d'au moins 4 caractères affecté (`=`) ou passé comme valeur (`:`) à
// quelque chose qui se nomme `password` / `mot_de_passe` / `motDePasse`. Ne matche PAS un
// identifiant (`password: MOT_DE_PASSE`), un template littéral (backticks), ni une variable qui
// se contente de nommer la chose (`const motDePasse = secrets.X`).
const MOTIF_MOT_DE_PASSE_EN_CLAIR = /(?:password|mot[_-]?de[_-]?passe)\s*[:=]\s*['"][^'"]{4,}['"]/i;

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

    it('trouve un mot de passe en clair affecté à une variable / une clé', () => {
      const trouves = coupables(
        [{ chemin: 'poison.mjs', contenu: "const password = 'hunter2-en-clair';" }],
        MOTIF_MOT_DE_PASSE_EN_CLAIR,
      );
      expect(trouves).toEqual(['poison.mjs']);
    });

    it('ne confond pas une variable qui NOMME un mot de passe avec un mot de passe en clair', () => {
      const propre = [
        { chemin: 'ok.mjs', contenu: 'const motDePasse = secrets.BANC_RLS_MOT_DE_PASSE;' },
        { chemin: 'ok2.ts', contenu: 'password: MOT_DE_PASSE,' },
      ];
      expect(coupables(propre, MOTIF_MOT_DE_PASSE_EN_CLAIR)).toEqual([]);
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
  // un motif générique qui laisserait passer un fichier de plus sans que personne le décide.
  // Les vingt-huit ci-dessous (compte à jour au 19 septembre 2026, pas figé) nomment
  // "service_role" pour avertir qu'elle est interdite, ou l'utilisent
  // légitimement côté outillage de test, de migration ou de CI (jamais dans l'application) — la
  // doc qui nomme le danger n'est pas le danger :
  //   - .env.exemple                                 : le commentaire qui explique le préfixe EXPO_PUBLIC_
  //   - CLAUDE.md                                     : §2, la règle elle-même
  //   - docs/backend.md                               : §6, "ce qui ne quitte jamais le serveur"
  //   - docs/prompts/L1.md                            : historique du prompt qui a posé cette règle
  //   - docs/prompts/L2.md                            : règle 5, la cause concrète des rouges en cascade de P2.4 (fixtures créées par service_role, pas par la session testée)
  //   - docs/prompts/L3.md                            : même règle 5, reprise pour ce lot (préparation des tests par service_role, jamais par la session dont le test mesure les droits)
  //   - eslint.config.js                              : le motif de la règle ESLint qui interdit la chaîne dans le code
  //   - supabase/migrations/0001_creer_identite.sql   : commentaires expliquant pourquoi aucun grant n'est posé pour ce rôle
  //   - supabase/migrations/0003_accorder_service_role.sql : corrige cette hypothèse — les GRANT que ce rôle nécessite réellement sur ce projet, justifiés ligne à ligne
  //   - supabase/migrations/0009_accorder_service_role_offres.sql : même correction, pour offres (P2.2 avait oublié service_role, trouvé par le banc de P2.4)
  //   - supabase/migrations/0010_accorder_service_role_verification_banc.sql : grant étroit pour la seule fixture du banc (statut_verification), en attendant la vraie fonction de P2.6
  //   - supabase/migrations/0012_creer_pieces_verification.sql : lecture complète + insertion pour le banc et le futur back-office (P2.6/P2.10), en attendant est_examinateur_courant()
  //   - supabase/migrations/0013_creer_role_examinateur.sql : commentaires expliquant pourquoi la promotion est_examinateur reste une opération manuelle par service_role, jamais par l'application
  //   - supabase/migrations/0014_accorder_service_role_promotion_examinateur.sql : GRANT UPDATE étroit (une seule colonne) pour que service_role puisse réaliser cette opération manuelle, jamais un rôle client
  //   - supabase/migrations/0015_creer_decision_verification.sql : GRANT SELECT seul pour service_role, pour vérifier au banc qu'une décision a bien été journalisée
  //   - supabase/migrations/0020_creer_disciplines_reference.sql : commentaire expliquant qu'ajouter une discipline reste une opération manuelle par service_role, jamais par l'application (même motif que 0013)
  //   - supabase/migrations/0021_accorder_service_role_disciplines.sql : GRANT étroit (select/insert/delete) pour que service_role prépare ses propres lignes de référence au banc, même trou que 0009/0010/0014
  //   - supabase/migrations/0023_creer_recherche_coachs.sql : GRANT SELECT pour service_role (lecture seule du référentiel de communes), et commentaire renvoyant au même trou récurrent (0009/0010/0014/0021)
  //   - supabase/migrations/0025_creer_langues_reference_et_communes_fkey.sql : GRANT SELECT pour service_role sur la table langues, accordé directement cette fois plutôt que par une migration de rattrapage (même trou que 0009/0010/0014/0021/0023, corrigé sans le reproduire)
  //   - supabase/migrations/0027_creer_invitations.sql : GRANT SELECT + INSERT pour service_role sur invitations (même trou récurrent, corrigé directement) — le commentaire nomme aussi explicitement que ce rôle ne contourne PAS les grants comme il contourne RLS, une hypothèse fausse trouvée en écrivant cette migration
  //   - supabase/migrations/0029_ajouter_fonctions_invitations_ecran.sql : commentaire renvoyant au même motif (aucune écriture directe accordée à service_role sur invitations, y compris pour ces deux fonctions)
  //   - supabase/migrations/0030_verrouiller_grants_invitations.sql : revoke explicite de service_role (et anon/authenticated) sur invitations et les cinq fonctions de L3bis — corrige un trou trouvé par la CI (pile fraîche), jamais vu contre le projet distant, où service_role reste alors sans le grant UPDATE qu'il avait localement sans jamais l'avoir reçu explicitement
  //   - docs/prompts/L3bis.md : règle 11 (cumulative) nomme "service_role" pour que le trou récurrent ci-dessus devienne une règle de conduite, pas une note qui ne survit qu'à ma mémoire
  //   - docs/dette.md : explique que le banc RLS insère ses coachs de test directement par service_role (formats/commune_base_insee posés à la main, faute de formulaire applicatif) — P3.2/P3.3
  //   - app/(admin)/verification.tsx : commentaire expliquant que la consultation des pièces passe par le compte examinateur, jamais par service_role
  //   - supabase/config.toml                          : commentaire généré par `supabase init`, décrivant les rôles de la Data API
  //   - src/test/rls.banc.ts                          : le nom de variable (SERVICE_ROLE_KEY) apparaît pour préparer le banc ; sa valeur, jamais écrite ici, est lue depuis .secrets-rls.local (ignoré par git) — jamais dans l'application
  //   - .github/workflows/banc-rls.yml                : le nom de variable shell issu de `supabase status -o env` (pile locale du runner) ; sa valeur, une clé de démo FIXE du CLI Supabase, n'est jamais écrite ici — lue puis passée à .secrets-rls.local, ignoré par git
  describe('clé service_role', () => {
    const EXCEPTIONS = new Set([
      '.env.exemple',
      'CLAUDE.md',
      'docs/backend.md',
      'docs/prompts/L1.md',
      'docs/prompts/L2.md',
      'docs/prompts/L3.md',
      'eslint.config.js',
      'supabase/migrations/0001_creer_identite.sql',
      'supabase/migrations/0003_accorder_service_role.sql',
      'supabase/migrations/0009_accorder_service_role_offres.sql',
      'supabase/migrations/0010_accorder_service_role_verification_banc.sql',
      'supabase/migrations/0012_creer_pieces_verification.sql',
      'supabase/migrations/0013_creer_role_examinateur.sql',
      'supabase/migrations/0014_accorder_service_role_promotion_examinateur.sql',
      'supabase/migrations/0015_creer_decision_verification.sql',
      'supabase/migrations/0020_creer_disciplines_reference.sql',
      'supabase/migrations/0021_accorder_service_role_disciplines.sql',
      'supabase/migrations/0023_creer_recherche_coachs.sql',
      'supabase/migrations/0025_creer_langues_reference_et_communes_fkey.sql',
      'supabase/migrations/0027_creer_invitations.sql',
      'supabase/migrations/0029_ajouter_fonctions_invitations_ecran.sql',
      'supabase/migrations/0030_verrouiller_grants_invitations.sql',
      'docs/prompts/L3bis.md',
      'docs/dette.md',
      'app/(admin)/verification.tsx',
      'supabase/config.toml',
      'src/test/rls.banc.ts',
      '.github/workflows/banc-rls.yml',
    ]);
    const fichiers = contenuDe(fichiersSuivisParGit().filter((chemin) => !EXCEPTIONS.has(chemin)));

    it('aucun fichier suivi par git (hors exceptions nommées) ne contient "service_role"', () => {
      expect(coupables(fichiers, /service_role/i)).toEqual([]);
    });
  });

  // Portée : l'outillage qui s'authentifie contre le VRAI projet Supabase de développement —
  // scripts/*.mjs et src/test/rls.banc.ts. Là, un mot de passe n'a rien à faire en clair dans
  // un fichier suivi : il vient de .secrets-rls.local (ignoré par git). Ailleurs (tests
  // d'écran, faux ports en mémoire), un mot de passe littéral est une donnée de fixture qui ne
  // s'authentifie contre rien de réel — hors périmètre ici, sinon ce balayage ne serait que du
  // bruit. Trouvé après coup : scripts/comptes-test-durables.mjs et rls.banc.ts en avaient un.
  describe('mot de passe en clair (outillage vers le vrai projet)', () => {
    const fichiers = contenuDe(
      fichiersSuivisParGit().filter(
        (chemin) => chemin.startsWith('scripts/') || chemin === 'src/test/rls.banc.ts',
      ),
    );

    it('aucun mot de passe en clair dans scripts/ ni dans src/test/rls.banc.ts', () => {
      expect(coupables(fichiers, MOTIF_MOT_DE_PASSE_EN_CLAIR)).toEqual([]);
    });
  });
});
