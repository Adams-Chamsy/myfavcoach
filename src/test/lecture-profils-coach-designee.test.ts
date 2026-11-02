import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, relative } from 'path';

// Toute lecture de profils_coach passe par un filtre sur `id`, ou par une fonction du serveur.
// Écrit le 2 novembre 2026, à la demande du développeur : quatre occurrences du même geste en
// une journée (monProfilCoachId le matin, lireDossierVerification à A1, puis lireEtatProfils et
// lireInformations au balayage du soir) — une façon d'écrire, plus une inattention.
//
// Pourquoi cette table : c'est la seule du dépôt dont les lignes d'AUTRUI sont lisibles par
// l'application (profils_coach_select_verifiee, 0008 : tout coach vérifié est public). Une
// lecture « select ... limit(1) » sans filtre y rend la propre ligne de l'appelant OU celle d'un
// coach vérifié, selon l'ordre du moteur. RLS ne lève rien : l'écran affiche simplement les
// données d'un autre. Le commentaire de lireEtatProfils affirmait « ne peut renvoyer QUE la ligne
// de l'appelant » : c'était faux depuis 0008, ce qui est pire qu'une absence de commentaire.
//
// La règle (docs/backend.md §7) : la ligne de l'appelant se désigne côté serveur
// (mon_profil_coach_id(), mon_dossier_verification()...), puis se lit par `.eq('id', ...)`.
const RACINE_DEPOT = join(__dirname, '..', '..');
const CE_FICHIER = relative(RACINE_DEPOT, __filename);

// Exceptions nommées, chacune avec sa raison.
const EXCEPTIONS = new Map<string, string>([
  [
    'app/(admin)/verification.tsx',
    'file d’attente du back-office : un examinateur liste PAR CONSTRUCTION les dossiers des ' +
      'autres (filtre sur statut_verification), verrou côté serveur (est_examinateur_courant)',
  ],
]);

const MOTIF_LECTURE = /\.from\(\s*['"`]profils_coach['"`]\s*\)/g;
const MOTIF_FILTRE_ID = /\.(eq|in)\(\s*['"`]id['"`]\s*,/;

// Chaque appel à .from('profils_coach'), jusqu'à la fin de son instruction : c'est là que le
// filtre doit se trouver. La fin se lit en comptant les parenthèses, crochets et accolades — un
// `;` ou une `,` au niveau zéro, ou la parenthèse qui referme l'appel englobant (un tableau
// d'appels parallèles, `Promise.all([...])`). Une simple coupure à la première virgule de fin de
// ligne s'arrêtait au milieu d'un objet (`update({ prenom: ..., })`) : deux faux positifs au
// premier essai, le 2 novembre 2026.
function finInstruction(texte: string): number {
  let profondeur = 0;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (c === '(' || c === '[' || c === '{') profondeur += 1;
    else if (c === ')' || c === ']' || c === '}') {
      if (profondeur === 0) return i;
      profondeur -= 1;
    } else if ((c === ';' || c === ',') && profondeur === 0) return i;
  }
  return texte.length;
}

function lecturesSansFiltreId(contenu: string): string[] {
  const coupables: string[] = [];
  for (const occurrence of contenu.matchAll(MOTIF_LECTURE)) {
    const debut = occurrence.index ?? 0;
    const reste = contenu.slice(debut);
    const instruction = reste.slice(0, finInstruction(reste));
    if (!MOTIF_FILTRE_ID.test(instruction)) {
      const ligne = contenu.slice(0, debut).split('\n').length;
      coupables.push(`ligne ${ligne} : ${instruction.replace(/\s+/g, ' ').slice(0, 90)}`);
    }
  }
  return coupables;
}

function fichiersScrutes(): string[] {
  const sortie = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'src', 'supabase/functions'],
    { cwd: RACINE_DEPOT, encoding: 'utf8' },
  );
  return sortie
    .split('\n')
    .filter(Boolean)
    .filter((chemin) => /\.(tsx?|jsx?)$/.test(chemin))
    .filter((chemin) => !/\.test\.|rls\.banc\.ts$/.test(chemin))
    .filter((chemin) => chemin !== CE_FICHIER);
}

describe('toute lecture de profils_coach désigne sa ligne (filtre sur id, ou fonction du serveur)', () => {
  // Le balayage doit pouvoir échouer : on l'exerce d'abord sur du code écrit exprès, y compris
  // la forme exacte des quatre défauts de la journée.
  it('se prouve capable de détecter une lecture sans filtre, et de ne pas en confondre une', () => {
    expect(
      lecturesSansFiltreId(
        "const r = await supabase.from('profils_coach').select('id, prenom').limit(1);",
      ),
    ).toHaveLength(1);
    expect(
      lecturesSansFiltreId(
        "Promise.all([\n  supabase.from('profils_coach').select('id, prenom, nom').limit(1),\n  autre,\n]);",
      ),
    ).toHaveLength(1);
    expect(
      lecturesSansFiltreId(
        "const r = await supabase.from('profils_coach').select('prenom').eq('id', monId);",
      ),
    ).toEqual([]);
    expect(
      lecturesSansFiltreId(
        "await supabase\n  .from('profils_coach')\n  .update({ bio })\n  .eq('id', coach.id);",
      ),
    ).toEqual([]);
    expect(
      lecturesSansFiltreId(
        "await supabase\n  .from('profils_coach')\n  .update({\n    prenom: p,\n    bio: b,\n  })\n  .eq('id', coach.id);",
      ),
    ).toEqual([]);
  });

  it('chaque exception nommée existe encore (une exception morte cacherait une lecture future)', () => {
    const fichiers = new Set(fichiersScrutes());
    for (const chemin of EXCEPTIONS.keys()) expect(fichiers).toContain(chemin);
  });

  it('aucune lecture de profils_coach sans filtre sur id, hors exceptions nommées', () => {
    const coupables: Record<string, string[]> = {};
    for (const chemin of fichiersScrutes()) {
      if (EXCEPTIONS.has(chemin)) continue;
      const trouvees = lecturesSansFiltreId(readFileSync(join(RACINE_DEPOT, chemin), 'utf8'));
      if (trouvees.length > 0) coupables[chemin] = trouvees;
    }
    expect(coupables).toEqual({});
  });
});
