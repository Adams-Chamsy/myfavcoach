import { execFileSync } from 'node:child_process';
import path from 'node:path';

describe('tokens generes', () => {
  it('src/theme/tokens.ts et src/theme/types.ts sont a jour par rapport a design/tokens.json', () => {
    const racine = path.resolve(__dirname, '../..');
    const script = path.join(racine, 'scripts', 'build-tokens.mjs');

    try {
      execFileSync('node', [script, '--check'], { cwd: racine, stdio: 'pipe' });
    } catch (erreur) {
      const details = erreur as { stderr?: Buffer; message?: string };
      const sortie = details.stderr
        ? details.stderr.toString('utf8')
        : (details.message ?? String(erreur));
      throw new Error(
        `src/theme n'est pas a jour par rapport a design/tokens.json. ` +
          `Lance npm run tokens et ne modifie jamais src/theme a la main.\n\n${sortie}`,
      );
    }
  });
});
