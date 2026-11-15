import { readFileSync } from 'node:fs';
import path from 'node:path';

import { LIBELLES_INTERDITS } from './libelles-interdits';

// docs/domaine.md §2 : UNE liste de termes interdits dans le dépôt (docs/prompts/L4.md, point
// 11). Elle vit à deux endroits qui ne peuvent pas s'importer l'un l'autre : ce dossier (nos
// propres textes, src/test/libelles-interdits.ts) et la base (les textes des coachs, contrôlés à
// la publication d'une offre par terme_interdit_dans, migration 0065). Ce test échoue si l'une
// change sans l'autre : mêmes termes, mêmes motifs, même ordre.
const MIGRATION = 'supabase/migrations/0065_controler_publication_offre.sql';

function motifsDeLaMigration(): { terme: string; motif: string }[] {
  const sql = readFileSync(path.join(__dirname, '..', '..', MIGRATION), 'utf8');
  return [...sql.matchAll(/^\s*\(\d+, '([^']+)', '([^']+)'\),?$/gm)].map((m) => ({
    terme: m[1] as string,
    motif: m[2] as string,
  }));
}

// La même expression, écrite pour Postgres (\m et \M : début et fin de mot) et pour JavaScript
// (\b) : c'est la seule différence d'écriture entre les deux listes.
const versPostgres = (motif: RegExp) => motif.source.replace(/^\\b/, '\\m').replace(/\\b$/, '\\M');

describe('termes interdits : la liste du dépôt et celle de la base sont la même', () => {
  it('mêmes termes, mêmes motifs, même ordre que src/test/libelles-interdits.ts', () => {
    expect(motifsDeLaMigration()).toEqual(
      LIBELLES_INTERDITS.map(({ terme, motif }) => ({ terme, motif: versPostgres(motif) })),
    );
  });

  it('chaque motif est insensible à la casse des deux côtés', () => {
    for (const { motif } of LIBELLES_INTERDITS) expect(motif.flags).toContain('i');
    const sql = readFileSync(path.join(__dirname, '..', '..', MIGRATION), 'utf8');
    expect(sql).toContain("coalesce(p_texte, '') ~* t.motif");
  });
});
