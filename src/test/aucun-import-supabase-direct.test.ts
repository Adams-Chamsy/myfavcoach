import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, relative } from 'path';

// Preuve par balayage de fichiers, même famille que src/test/secrets-interdits.test.ts :
// aucun écran ni composant n'importe src/services/supabase/ directement (CLAUDE.md §2/§3,
// docs/prompts/L1.md P1.6) — seuls les adaptateurs de src/services/auth/ et src/services/
// donnees/ ont le droit de le faire. La règle, pas la bonne volonté.
const RACINE_DEPOT = join(__dirname, '..', '..');
const CE_FICHIER = relative(RACINE_DEPOT, __filename);

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

// Fonction pure, sans lecture disque : exercée directement par les tests "se prouve capable de
// détecter" ci-dessous, avant de lui faire confiance sur le vrai dépôt.
const MOTIF_IMPORT_SUPABASE =
  /(?:from\s+['"][^'"]*\bservices\/supabase\b[^'"]*['"]|require\(\s*['"][^'"]*\bservices\/supabase\b[^'"]*['"]\s*\))/;

function coupables(fichiers: { chemin: string; contenu: string }[]): string[] {
  return fichiers.filter((f) => MOTIF_IMPORT_SUPABASE.test(f.contenu)).map((f) => f.chemin);
}

describe('aucun import direct de src/services/supabase/ hors des adaptateurs', () => {
  describe('le balayage se prouve lui-même capable de détecter', () => {
    it('trouve un import relatif écrit exprès pour le contenir', () => {
      const trouves = coupables([
        {
          chemin: 'app/poison.tsx',
          contenu: "import { supabase } from '../../services/supabase/client';",
        },
      ]);
      expect(trouves).toEqual(['app/poison.tsx']);
    });

    it('trouve un import par alias écrit exprès pour le contenir', () => {
      const trouves = coupables([
        {
          chemin: 'src/fonctionnalites/poison.tsx',
          contenu: "import { supabase } from '@/services/supabase/client';",
        },
      ]);
      expect(trouves).toEqual(['src/fonctionnalites/poison.tsx']);
    });

    it('trouve un require() écrit exprès pour le contenir', () => {
      const trouves = coupables([
        {
          chemin: 'src/composants/poison.tsx',
          contenu: "const { supabase } = require('@/services/supabase/client');",
        },
      ]);
      expect(trouves).toEqual(['src/composants/poison.tsx']);
    });

    it("ne trouve rien dans un contenu propre, même s'il mentionne Supabase en prose", () => {
      const propre = [
        {
          chemin: 'src/fonctionnalites/propre.tsx',
          contenu: "// Cet écran appelle le port d'authentification, pas Supabase directement.",
        },
      ];
      expect(coupables(propre)).toEqual([]);
    });

    it('ne confond pas src/services/auth/ ou src/services/donnees/ (les adaptateurs eux-mêmes) avec une violation', () => {
      const legitime = [
        {
          chemin: 'src/services/auth/supabase.ts',
          contenu: "import { supabase } from '@/services/supabase/client';",
        },
      ];
      // Le motif matcherait ce contenu — c'est le PÉRIMÈTRE ci-dessous (app/, composants/,
      // fonctionnalites/) qui exempte les adaptateurs, jamais le motif lui-même.
      expect(coupables(legitime)).toEqual(['src/services/auth/supabase.ts']);
    });
  });

  // Périmètre : app/ (routes), src/composants/ (primitives sans logique métier),
  // src/fonctionnalites/ (où vivront les écrans à partir de P1.7 — c'est là que la tentation
  // apparaîtra, docs/prompts/L1.md P1.6). PAS src/services/ : c'est là que vivent les
  // adaptateurs eux-mêmes, qui ont le droit d'importer le client.
  describe('sur le vrai dépôt', () => {
    const PREFIXES = ['app/', 'src/composants/', 'src/fonctionnalites/'];
    // app/(admin)/ est l'EXCEPTION documentée (docs/ecrans/L2-10-back-office-verification.md,
    // docs/backend.md §9) : il n'utilise JAMAIS src/services/supabase/client.ts (celui du
    // paquet mobile) mais instancie son propre client (src/services/supabase/client-admin.ts),
    // avec sa propre variable d'environnement. C'est l'app mobile qui ne doit jamais importer
    // Supabase directement — app/(admin)/ n'en fait pas partie.
    const fichiers = contenuDe(
      fichiersSuivisParGit().filter(
        (chemin) =>
          PREFIXES.some((prefixe) => chemin.startsWith(prefixe)) &&
          !chemin.startsWith('app/(admin)/'),
      ),
    );

    it("aucun fichier de app/, src/composants/ ou src/fonctionnalites/ n'importe src/services/supabase/ directement", () => {
      expect(coupables(fichiers)).toEqual([]);
    });
  });

  // L2-10 : l'exception ci-dessus (app/(admin)/) a une contrepartie précise — jamais LE CLIENT
  // MOBILE (services/supabase/client, la clé anonyme embarquée dans le paquet). Seul
  // services/supabase/client-admin (sa propre clé, docs/backend.md §9) est permis ici.
  describe("app/(admin)/ n'importe jamais le client mobile", () => {
    const MOTIF_CLIENT_MOBILE = /services\/supabase\/client['"]/;
    const fichiersAdmin = contenuDe(
      fichiersSuivisParGit().filter((chemin) => chemin.startsWith('app/(admin)/')),
    );

    it("aucun fichier de app/(admin)/ n'importe services/supabase/client (le client mobile)", () => {
      const coupablesMobile = fichiersAdmin
        .filter((f) => MOTIF_CLIENT_MOBILE.test(f.contenu))
        .map((f) => f.chemin);
      expect(coupablesMobile).toEqual([]);
    });
  });
});
