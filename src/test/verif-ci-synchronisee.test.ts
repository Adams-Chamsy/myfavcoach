import { readFileSync } from 'fs';
import { join } from 'path';

// npm run verif (package.json) et .github/workflows/verif.yml decrivent la meme suite de
// verifications, sous deux formes distinctes qui peuvent diverger silencieusement — une
// nouvelle etape ajoutee a l'une sans l'autre ne casse rien a l'ecriture, elle se remarque
// seulement le jour ou la CI passe malgre une regle locale cassee, ou l'inverse. Ce test
// compare les deux listes plutot que de compter sur un commentaire qu'on oublie de relire.
//
// Seul ecart tolere : test:rls, volontairement absent de la CI (commentaire en tete de
// verif.yml, docs/dette.md) — jamais un autre.
const RACINE_DEPOT = join(__dirname, '..', '..');

function extraireEtapesVerif(scriptVerif: string): string[] {
  return scriptVerif.split('&&').map((segment) => {
    const propre = segment.trim();
    if (propre === 'npm test') return 'test';
    const correspondance = /^npm run ([a-z0-9:_-]+)$/.exec(propre);
    if (!correspondance) {
      throw new Error(
        `Segment de "verif" (package.json) non reconnu par ce test : "${propre}". ` +
          'Adapte extraireEtapesVerif si ce nouveau segment est legitime.',
      );
    }
    return correspondance[1];
  });
}

function extraireEtapesWorkflow(contenuYaml: string): string[] {
  const etapes: string[] = [];
  for (const ligne of contenuYaml.split('\n')) {
    const correspondance = /^\s*run:\s*(.+)$/.exec(ligne);
    if (!correspondance) continue;
    const commande = correspondance[1].trim();
    if (commande === 'npm ci') continue;
    if (commande === 'npm test') {
      etapes.push('test');
      continue;
    }
    const commandeNpmRun = /^npm run ([a-z0-9:_-]+)$/.exec(commande);
    if (commandeNpmRun) {
      etapes.push(commandeNpmRun[1]);
      continue;
    }
    throw new Error(
      `Etape de verif.yml non reconnue par ce test : "${commande}". ` +
        'Adapte extraireEtapesWorkflow si cette nouvelle etape est legitime.',
    );
  }
  return etapes;
}

describe('verif.yml reste synchronisé avec npm run verif', () => {
  it('liste, dans le même ordre, toutes les étapes de npm run verif sauf test:rls', () => {
    const packageJson = JSON.parse(readFileSync(join(RACINE_DEPOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const etapesVerif = extraireEtapesVerif(packageJson.scripts.verif);
    const etapesWorkflow = extraireEtapesWorkflow(
      readFileSync(join(RACINE_DEPOT, '.github/workflows/verif.yml'), 'utf8'),
    );

    const etapesAttendues = etapesVerif.filter((etape) => etape !== 'test:rls');
    expect(etapesWorkflow).toEqual(etapesAttendues);
  });

  it("test:rls n'apparaît jamais dans verif.yml, même renommé — voir le commentaire en tête du fichier", () => {
    const contenu = readFileSync(join(RACINE_DEPOT, '.github/workflows/verif.yml'), 'utf8');
    const etapes = extraireEtapesWorkflow(contenu);
    expect(etapes).not.toContain('test:rls');
  });
});
