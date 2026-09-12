import { existsSync, statSync } from 'fs';
import { join } from 'path';

// Garde mécanique (CLAUDE.md §4, `scripts/proteger-env.mjs`) contre l'incident qui l'a motivée :
// un agent a écrasé un .env réel avec `cp .env.exemple .env`. .env en lecture seule (chmod 444)
// fait échouer ce genre d'écrasement au lieu de le laisser passer en silence — ce test vérifie
// que la protection est bien en place, pas qu'elle a jamais été contournée (ça, aucun test ne
// peut le voir après coup).
//
// Local seulement : .env n'existe pas dans un clone frais ni en CI (qui écrit sa propre
// substitution) — rien à protéger dans ce cas, ce test passe trivialement, comme le reste des
// balayages de ce dépôt quand leur dossier cible n'existe pas encore.
const RACINE_DEPOT = join(__dirname, '..', '..');
const CHEMIN_ENV = join(RACINE_DEPOT, '.env');

describe('.env, quand il existe localement, reste en lecture seule (CLAUDE.md §4)', () => {
  it('.env est protégé en écriture (chmod 444) — `npm run env:proteger` sinon', () => {
    if (!existsSync(CHEMIN_ENV)) return;
    const droits = statSync(CHEMIN_ENV).mode & 0o777;
    const inscriptibleParLeProprietaire = (droits & 0o200) !== 0;
    expect(inscriptibleParLeProprietaire).toBe(false);
  });
});
