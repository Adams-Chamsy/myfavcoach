import { execFileSync } from 'child_process';
import { join } from 'path';

// Aucune adresse n'est servie par deux écrans. Écrit le 2 novembre 2026 : le back-office
// (app/(admin)/) et deux écrans publics partageaient /connexion et /verification, parce qu'un
// groupe entre parenthèses n'apparaît pas dans l'adresse. En développement, le back-office
// masquait les deux écrans publics. Personne ne l'a vu en deux mois : verif:serveur ne
// regardait que deux adresses, sans vérifier l'écran.
//
// Ce test est EXHAUSTIF, sans serveur : il calcule l'adresse de chaque fichier de route comme
// expo-router le fait (groupes `(x)` retirés, `index` retiré, `[param]` devenu un paramètre),
// et exige que chaque adresse n'ait qu'un fichier. scripts/verifier-serveur-dev.mjs prouve, lui,
// sur un vrai serveur, que les adresses autrefois disputées montrent chacune le bon écran.
const RACINE_DEPOT = join(__dirname, '..', '..');

// Adresses partagées en connaissance de cause, chacune avec sa raison.
// Décidées par le développeur le 2 novembre 2026.
const EXCEPTIONS = new Map<string, string>([
  [
    '/',
    'structure prévue : app/index.tsx (démarrage) prend « / » et redirige selon la session ' +
      '(determinerDestination) ; l’écran de bienvenue, app/(public)/index.tsx, est atteint par lui',
  ],
  [
    '/moi',
    'compte client et compte coach, même écran (L1-07) : sur mobile, la navigation passe par le ' +
      'nom complet de la route ; sur le web, un coach qui recharge atterrit dans l’espace client ' +
      '(docs/dette.md, échéance « si le web devient une cible »)',
  ],
]);

export function adresseDeRoute(fichier: string): string {
  const chemin = fichier.replace(/^app\//, '').replace(/\.(tsx|ts|jsx|js)$/, '');
  const segments = chemin
    .split('/')
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) => (/^\[.*\]$/.test(segment) ? ':param' : segment));
  if (segments[segments.length - 1] === 'index') segments.pop();
  return '/' + segments.join('/');
}

function fichiersDeRoute(): string[] {
  const sortie = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', 'app'],
    {
      cwd: RACINE_DEPOT,
      encoding: 'utf8',
    },
  );
  return sortie
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(tsx|ts|jsx|js)$/.test(f))
    .filter((f) => !/\.test\./.test(f))
    .filter((f) => !/(^|\/)_layout\.(tsx|ts|jsx|js)$/.test(f));
}

function adressesPartagees(fichiers: string[]): Record<string, string[]> {
  const parAdresse = new Map<string, string[]>();
  for (const fichier of fichiers) {
    const adresse = adresseDeRoute(fichier);
    parAdresse.set(adresse, [...(parAdresse.get(adresse) ?? []), fichier]);
  }
  return Object.fromEntries([...parAdresse].filter(([, liste]) => liste.length > 1));
}

describe('aucune adresse n’est servie par deux écrans', () => {
  it('calcule l’adresse comme expo-router : groupes, index et paramètres', () => {
    expect(adresseDeRoute('app/(public)/connexion.tsx')).toBe('/connexion');
    expect(adresseDeRoute('app/(admin)/admin/connexion.tsx')).toBe('/admin/connexion');
    expect(adresseDeRoute('app/(client)/(tabs)/moi.tsx')).toBe('/moi');
    expect(adresseDeRoute('app/(public)/index.tsx')).toBe('/');
    expect(adresseDeRoute('app/(client)/coach/[id].tsx')).toBe('/coach/:param');
  });

  it('se prouve capable de détecter deux fichiers sur la même adresse', () => {
    expect(
      adressesPartagees(['app/(admin)/connexion.tsx', 'app/(public)/connexion.tsx', 'app/a.tsx']),
    ).toEqual({ '/connexion': ['app/(admin)/connexion.tsx', 'app/(public)/connexion.tsx'] });
  });

  it('chaque exception nommée correspond encore à une adresse réellement partagée', () => {
    const partagees = adressesPartagees(fichiersDeRoute());
    for (const adresse of EXCEPTIONS.keys()) expect(Object.keys(partagees)).toContain(adresse);
  });

  it('chaque adresse du dépôt a un seul fichier de route, hors exceptions nommées', () => {
    const partagees = adressesPartagees(fichiersDeRoute());
    for (const adresse of EXCEPTIONS.keys()) delete partagees[adresse];
    expect(partagees).toEqual({});
  });
});
