import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, relative } from 'path';

// P1.15 (CLAUDE.md §8) : les trois écritures qui changent EtatProfils — creerProfilCoach,
// basculerProfil, enregistrerInformations — ne sont appelées QUE par FournisseurDonnees, qui
// relit l'état juste après. `useDonnees().port` est typé PortDonneesLecture (ces trois
// retirées), donc un écran qui écrit `port.basculerProfil(...)` ne compile déjà pas ; ce
// balayage ferme le contournement par `as` et attrape aussi un double de test qui les
// appellerait sur un port brut au lieu de la méthode enveloppée du contexte.
const RACINE_DEPOT = join(__dirname, '..', '..');
const CE_FICHIER = relative(RACINE_DEPOT, __filename);

// Le seul endroit légitime : l'enveloppe elle-même.
const FOURNISSEUR = 'src/fonctionnalites/identite/fournisseur-donnees.tsx';
// port.ts les déclare, faux.ts / supabase.ts les implémentent — définitions, pas des appels
// sur un objet `port`.
const PREFIXE_ADAPTATEURS = 'src/services/donnees/';

// `port.` (ou `xxxPort.`) suivi d'une des trois méthodes et d'une parenthèse d'appel. Ne
// matche pas `jest.spyOn(portDonnees, 'basculerProfil')` (chaîne, pas accès membre) ni
// `const { basculerProfil } = useDonnees()` (déstructuration).
const MOTIF_APPEL_DIRECT = /\bport\.(creerProfilCoach|basculerProfil|enregistrerInformations)\s*\(/;

function fichiersScrutes(): string[] {
  const sortie = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', 'app', 'src'],
    { cwd: RACINE_DEPOT, encoding: 'utf8' },
  );
  return sortie
    .split('\n')
    .filter(Boolean)
    .filter((chemin) => /\.(tsx?|jsx?)$/.test(chemin))
    .filter((chemin) => chemin !== CE_FICHIER)
    .filter((chemin) => chemin !== FOURNISSEUR)
    .filter((chemin) => !chemin.startsWith(PREFIXE_ADAPTATEURS));
}

function coupables(fichiers: { chemin: string; contenu: string }[], motif: RegExp): string[] {
  return fichiers.filter((f) => motif.test(f.contenu)).map((f) => f.chemin);
}

describe('l’écriture d’EtatProfils passe par le fournisseur', () => {
  // Le balayage doit pouvoir échouer : on l'exerce d'abord sur du contenu écrit exprès.
  it('se prouve capable de détecter un appel direct, et de ne pas en confondre un', () => {
    const echantillons = [
      { chemin: 'poison.tsx', contenu: 'const r = await port.basculerProfil("coach");' },
      { chemin: 'ok-spy.ts', contenu: "jest.spyOn(portDonnees, 'basculerProfil');" },
      { chemin: 'ok-destr.tsx', contenu: 'const { basculerProfil } = useDonnees();' },
    ];
    expect(coupables(echantillons, MOTIF_APPEL_DIRECT)).toEqual(['poison.tsx']);
  });

  it('aucun fichier de app/ ou src/ (hors fournisseur et adaptateurs) n’appelle port.<écriture d’état>(', () => {
    const fichiers = fichiersScrutes().map((chemin) => ({
      chemin,
      contenu: readFileSync(join(RACINE_DEPOT, chemin), 'utf8'),
    }));
    expect(coupables(fichiers, MOTIF_APPEL_DIRECT)).toEqual([]);
  });
});
