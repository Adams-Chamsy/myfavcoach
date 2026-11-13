import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import { EXCEPTIONS_ADRESSES_PRIVEES } from '@/fonctionnalites/identite/garde-adresses-privees';

// Décidé le 13 novembre 2026, après la régression du 12 : la garde des adresses privées renvoyait
// le lien d'invitation (app/(public)/y/[jeton].tsx → /(client)/coach/{id}) vers la bienvenue,
// pour un visiteur sans session. Une adresse privée écrite dans un écran PUBLIC est par
// construction ouverte sans session : elle doit être une exception nommée de la garde
// (EXCEPTIONS_ADRESSES_PRIVEES), sinon la garde la refermera.
//
// Ce balayage lit les adresses écrites en dur (chaînes et gabarits) dans app/(public)/. Il ne voit
// pas une adresse calculée (la redirection de app/(public)/_layout.tsx passe par
// determinerDestination, et seulement AVEC une session vérifiée : hors de son champ), ni une
// navigation faite par un composant importé depuis src/ — aucun écran public n'en a aujourd'hui.
const RACINE_DEPOT = join(__dirname, '..', '..');
const MOTIF_ADRESSE_PRIVEE = /['"`](\/\((?:client|coach|compte|onboarding)\)[^'"`?$]*)/g;

function fichiersPublics(): string[] {
  const sortie = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: RACINE_DEPOT,
    encoding: 'utf8',
  });
  return sortie
    .split('\n')
    .filter((chemin) => chemin.startsWith('app/(public)/') && chemin.endsWith('.tsx'))
    .filter((chemin) => !chemin.endsWith('.test.tsx'));
}

function estException(adresse: string): boolean {
  const segments = adresse.split('/').filter(Boolean);
  return EXCEPTIONS_ADRESSES_PRIVEES.some((e) => e.segments.every((s, i) => segments[i] === s));
}

function nonCouvertes(fichiers: { chemin: string; contenu: string }[]): string[] {
  return fichiers.flatMap(({ chemin, contenu }) =>
    [...contenu.matchAll(MOTIF_ADRESSE_PRIVEE)]
      .map((m) => m[1] ?? '')
      .filter((adresse) => !estException(adresse))
      .map((adresse) => `${chemin} → ${adresse}`),
  );
}

describe('une adresse privée atteinte depuis un écran public est une exception nommée de la garde', () => {
  it('détecte une adresse privée écrite exprès', () => {
    expect(
      nonCouvertes([{ chemin: 'poison.tsx', contenu: "router.push('/(client)/moi')" }]),
    ).toEqual(['poison.tsx → /(client)/moi']);
  });

  it('laisse passer une adresse couverte par une exception', () => {
    expect(
      nonCouvertes([{ chemin: 'ok.tsx', contenu: 'router.push(`/(client)/coach/${id}`)' }]),
    ).toEqual([]);
  });

  it('le balayage lit bien des écrans publics, dont le lien d’invitation', () => {
    expect(fichiersPublics()).toContain('app/(public)/y/[jeton].tsx');
  });

  it('chaque adresse privée des écrans publics réels est une exception de la garde', () => {
    const fichiers = fichiersPublics().map((chemin) => ({
      chemin,
      contenu: readFileSync(join(RACINE_DEPOT, chemin), 'utf8'),
    }));
    expect(nonCouvertes(fichiers)).toEqual([]);
  });
});
