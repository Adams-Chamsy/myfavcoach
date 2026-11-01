import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { LIBELLES_INTERDITS } from './libelles-interdits';

// docs/domaine.md §2 : le jeu de démonstration (src/fixtures/) alimente la galerie, les tests
// d'écran et, demain, n'importe quel écran qui parle de ce que le client achète. Un terme interdit
// qui y dort finit à l'écran sans qu'aucun test d'écran ne le voie — c'est là qu'ils se cachent
// (trouvé le 1er novembre 2026 : « Messagerie illimitée » dans l'offre de Yannick).
//
// Ce qui est balayé : les chaînes du code (entre apostrophes, guillemets ou accents graves),
// jamais les commentaires, que personne ne lit à l'écran.
const DOSSIER = join(__dirname, '..', 'fixtures');

function chainesDe(source: string): string[] {
  const sansCommentaires = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const chaines: string[] = [];
  const motif = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g;
  for (const m of sansCommentaires.matchAll(motif)) chaines.push(m[1] ?? m[2] ?? m[3] ?? '');
  return chaines;
}

const fichiers = readdirSync(DOSSIER).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));

describe('libellés interdits : le jeu de démonstration', () => {
  it('balaie au moins un fichier (un dossier vide ne prouverait rien)', () => {
    expect(fichiers.length).toBeGreaterThan(0);
  });

  it.each(fichiers)('%s ne contient aucun des dix termes interdits', (fichier) => {
    const chaines = chainesDe(readFileSync(join(DOSSIER, fichier), 'utf8'));
    const trouves = LIBELLES_INTERDITS.flatMap(({ terme, motif }) =>
      chaines.filter((c) => motif.test(c)).map((c) => `${terme} : « ${c} »`),
    );
    expect(trouves).toEqual([]);
  });

  it('le balayage voit une chaîne, et ignore un commentaire', () => {
    expect(chainesDe("const a = 'Débloque'; // premium")).toEqual(['Débloque']);
  });
});
