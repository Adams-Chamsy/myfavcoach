import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, relative } from 'path';

// L2-10, critère 6 : un test parcourt tous les écrans de (client)/(coach)/(compte)/(public)/
// (onboarding) et échoue s'il trouve une navigation, un lien ou une référence de route vers
// (admin) — même mécanisme que aucun-import-supabase-direct.test.ts. Une interdiction non
// éprouvée par un test qui tente l'interdit est une interdiction absente (docs/prompts/L1.md,
// tableau des faux verts).
const RACINE_DEPOT = join(__dirname, '..', '..');
const CE_FICHIER = relative(RACINE_DEPOT, __filename);
const GROUPES_MOBILES = [
  'app/(client)/',
  'app/(coach)/',
  'app/(compte)/',
  'app/(public)/',
  'app/(onboarding)/',
];

const MOTIF_REFERENCE_ADMIN = /\(admin\)/;

function fichiersMobiles(): string[] {
  const sortie = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: RACINE_DEPOT,
    encoding: 'utf8',
  });
  return sortie
    .split('\n')
    .filter(Boolean)
    .filter((chemin) => chemin !== CE_FICHIER)
    .filter((chemin) => GROUPES_MOBILES.some((groupe) => chemin.startsWith(groupe)));
}

function coupablesParmi(fichiers: { chemin: string; contenu: string }[]): string[] {
  return fichiers.filter((f) => MOTIF_REFERENCE_ADMIN.test(f.contenu)).map((f) => f.chemin);
}

function coupables(chemins: string[]): string[] {
  return coupablesParmi(
    chemins.map((chemin) => ({
      chemin,
      contenu: readFileSync(join(RACINE_DEPOT, chemin), 'utf8'),
    })),
  );
}

describe('aucun écran mobile ne référence app/(admin)/ (L2-10, critère 6)', () => {
  it('détecte une référence écrite exprès', () => {
    const trouves = coupablesParmi([
      { chemin: 'poison.tsx', contenu: 'router.push("/(admin)/verification")' },
    ]);
    expect(trouves).toEqual(['poison.tsx']);
  });

  it('ne confond pas avec un chemin propre', () => {
    const propres = coupablesParmi([
      { chemin: 'ok.tsx', contenu: 'router.push("/(coach)/pilotage")' },
    ]);
    expect(propres).toEqual([]);
  });

  it('ne trouve rien dans les groupes de routes mobiles réels', () => {
    expect(coupables(fichiersMobiles())).toEqual([]);
  });
});
