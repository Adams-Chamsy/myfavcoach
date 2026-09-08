import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, relative } from 'path';

// CLAUDE.md §5 : une surface qui fixe son propre thème (une île, coach ou encre) lit les
// valeurs du thème CHOISI explicitement (themes.clair.*, themes.sombre.*) — jamais par le
// contexte ambiant (useTheme().couleur / theme.couleur.*). Un token dont la valeur dépend du
// thème ambiant ("inversible") s'inverse avec lui, produisant du texte invisible sur son propre
// fond dès que la surface est rendue sous un thème ambiant différent de celui prévu
// (`themeForce="sombre"` de la galerie, `npm run test:a11y`, un futur vrai thème sombre).
//
// Trouvé TROIS fois au jalon 1 malgré la règle déjà écrite : src/composants/
// barre-navigation.tsx (fond de la barre coach, L0), app/(public)/index.tsx (fond de l'écran de
// bienvenue, L1), et le bloc encre de app/(client)/moi.tsx — implémenté dans
// src/fonctionnalites/identite/feuille-bascule.tsx — (L1, P1.12). Une règle répétée sans être
// attrapée mécaniquement ne tient pas : ce balayage la rend exécutable.
//
// Deux tokens prouvés fautifs jusqu'ici, pas une liste devinée par anticipation :
// - fond.inverse change réellement de valeur d'un thème à l'autre (#17211E en clair,
//   #F4F0E9 en sombre, src/theme/tokens.ts) — un usage ambiant est un pari sur le thème actif.
// - texte.surSombre garde LA MÊME valeur dans les deux thèmes aujourd'hui (#F4F0E9 partout) —
//   ce qui est justement le piège : un texte "toujours clair" posé sur un fond qui, lui,
//   s'inverse (fond.inverse) cesse d'être lisible dès que l'ambiant change, alors que rien dans
//   le code de ce texte n'a l'air fautif à l'œil.
// Étendre TOKENS_RESERVES_AUX_ILES dès qu'un troisième token se révèle fautif — jamais avant.
//
// Portée de la détection, honnêtement : ce balayage repère l'ACCÈS AMBIANT — la sous-chaîne
// "couleur.fond.inverse" / "couleur.texte.surSombre", présente uniquement quand la valeur passe
// par la propriété .couleur d'un thème résolu (useTheme(), ou un theme/couleur reçu en
// paramètre) — jamais quand elle vient de themes.clair.* / themes.sombre.* directement, qui
// n'ont pas cette propriété intermédiaire (voir src/theme/tokens.ts : "themes.sombre.fond" est
// un objet direct, pas "themes.sombre.couleur.fond"). Il NE PEUT PAS suivre un thème réassigné à
// une variable intermédiaire avant d'être déstructuré plus loin (`const t = useTheme(); const c
// = t.couleur; const { fond } = c; fond.inverse` ne matcherait pas la sous-chaîne littérale) —
// une détection par les types (TypeScript compiler API) verrait ce cas, une détection texte non.
// Accepté comme limite plutôt que fabriqué une sécurité illusoire : le motif littéral couvre les
// trois occurrences réelles trouvées à ce jour, dans le style d'écriture réellement utilisé
// partout ailleurs dans ce dépôt (jamais de thème réassigné avant lecture) ; une relecture reste
// le filet pour une déconstruction plus retorse.
//
// Les commentaires qui EXPLIQUENT un bug passé (barre-navigation.test.tsx en a un) répètent
// forcément la même sous-chaîne en prose : chaque ligne est donc dépouillée de son commentaire
// `//` avant la recherche, jamais un balayage brut du fichier.
const TOKENS_RESERVES_AUX_ILES = ['couleur.fond.inverse', 'couleur.texte.surSombre'] as const;
type TokenReserve = (typeof TOKENS_RESERVES_AUX_ILES)[number];

// Chemins autorisés à lire ces tokens via le contexte ambiant, un par un, jamais un dossier
// entier — chacun avec sa raison, jamais une exemption de confort :
// - modale.tsx / feuille-basse.tsx : le voile translucide derrière la feuille/modale. Aucun
//   texte n'est jamais dessiné dessus : rien à rendre invisible.
// - chip.tsx : pairé avec texte.surMarque, qui s'inverse LUI AUSSI avec le thème ambiant — les
//   deux bougent ensemble, contrairement au bug (un seul côté de la paire qui reste fixe).
const EXCEPTIONS: Record<TokenReserve, string[]> = {
  'couleur.fond.inverse': [
    'src/composants/modale.tsx',
    'src/composants/feuille-basse.tsx',
    'src/composants/chip.tsx',
  ],
  'couleur.texte.surSombre': [],
};

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

// Dépouille chaque ligne de son commentaire `//` : un commentaire qui explique un bug passé
// répète la même sous-chaîne en prose (barre-navigation.test.tsx), sans quoi ce balayage se
// dénoncerait lui-même. Limite acceptée : un "//" à l'intérieur d'une chaîne de caractères
// (une URL, par ex. "myfavcoach://...") coupe la ligne au même endroit, à tort — jamais observé
// combiné à un des deux tokens sur la même ligne dans ce dépôt.
function retirerCommentairesLigne(contenu: string): string {
  return contenu
    .split('\n')
    .map((ligne) => {
      const index = ligne.indexOf('//');
      return index === -1 ? ligne : ligne.slice(0, index);
    })
    .join('\n');
}

function coupablesPourToken(
  token: TokenReserve,
  fichiers: { chemin: string; contenu: string }[],
): string[] {
  const autorises = new Set(EXCEPTIONS[token]);
  return fichiers
    .filter((f) => retirerCommentairesLigne(f.contenu).includes(token))
    .filter((f) => !autorises.has(f.chemin))
    .map((f) => f.chemin);
}

describe('aucune surface ne lit un token réservé aux îles via le contexte ambiant (CLAUDE.md §5)', () => {
  describe('le balayage se prouve lui-même capable de détecter', () => {
    it('trouve fond.inverse lu via useTheme(), écrit exprès pour le contenir', () => {
      const trouves = coupablesPourToken('couleur.fond.inverse', [
        {
          chemin: 'src/composants/poison.tsx',
          contenu: 'backgroundColor: theme.couleur.fond.inverse,',
        },
      ]);
      expect(trouves).toEqual(['src/composants/poison.tsx']);
    });

    it('trouve texte.surSombre lu via un theme déstructuré, écrit exprès pour le contenir', () => {
      const trouves = coupablesPourToken('couleur.texte.surSombre', [
        {
          chemin: 'src/composants/poison.tsx',
          contenu: 'const { couleur } = theme;\ncolor: couleur.texte.surSombre,',
        },
      ]);
      expect(trouves).toEqual(['src/composants/poison.tsx']);
    });

    it("ne trouve rien dans un fichier qui lit la valeur FIXE (themes.sombre.*), jamais l'ambiant", () => {
      const trouves = coupablesPourToken('couleur.fond.inverse', [
        {
          chemin: 'src/composants/propre.tsx',
          contenu: 'backgroundColor: themes.sombre.fond.canevas,',
        },
      ]);
      expect(trouves).toEqual([]);
    });

    it('ne trouve rien dans un commentaire qui explique un bug passé, jamais dans du code réel', () => {
      const trouves = coupablesPourToken('couleur.fond.inverse', [
        {
          chemin: 'src/composants/propre.test.tsx',
          contenu: '// se serait retourné avec le thème actif (theme.couleur.fond.inverse)',
        },
      ]);
      expect(trouves).toEqual([]);
    });

    it('exempte un chemin nommé dans EXCEPTIONS, jamais un chemin absent de la liste', () => {
      const fichiers = [
        { chemin: 'src/composants/modale.tsx', contenu: 'theme.couleur.fond.inverse' },
        { chemin: 'src/composants/poison.tsx', contenu: 'theme.couleur.fond.inverse' },
      ];
      expect(coupablesPourToken('couleur.fond.inverse', fichiers)).toEqual([
        'src/composants/poison.tsx',
      ]);
    });
  });

  describe('sur le vrai dépôt', () => {
    const fichiers = contenuDe(
      fichiersSuivisParGit().filter((chemin) => chemin.endsWith('.ts') || chemin.endsWith('.tsx')),
    );

    it.each(TOKENS_RESERVES_AUX_ILES)(
      'aucun fichier hors des exceptions nommées ne lit %s via le contexte ambiant',
      (token) => {
        expect(coupablesPourToken(token, fichiers)).toEqual([]);
      },
    );
  });
});
