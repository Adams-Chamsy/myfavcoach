import { readFileSync } from 'fs';
import { join } from 'path';

// docs/ecrans/L1-04-connexion.md, critère 5 : "Les trois écrans partagent les mêmes composants
// de champ et de pied : un test vérifie qu'aucun style de champ n'est redéfini localement."
//
// Une redéfinition locale commencerait par un <TextInput> construit à la main dans l'écran — le
// seul <TextInput> légitime pour un champ de saisie de texte est celui de
// src/composants/champ.tsx (déjà testé par champ.test.tsx). Scan de source, même principe que
// src/test/secrets-interdits.test.ts : un test de rendu ne verrait qu'un style DIFFÉRENT du
// composant partagé, jamais un style ACCIDENTELLEMENT identique par copier-coller — le vrai
// défaut que ce critère vise à empêcher.
const FICHIERS_A_VERIFIER = [
  'app/(public)/connexion.tsx',
  'app/(public)/mot-de-passe-oublie.tsx',
  'app/(public)/nouveau-mot-de-passe.tsx',
];

describe('les écrans de L1-04 réutilisent Champ, jamais un TextInput local (docs/ecrans/L1-04-connexion.md, critère 5)', () => {
  it.each(FICHIERS_A_VERIFIER)('%s ne construit aucun <TextInput> directement', (chemin) => {
    const source = readFileSync(join(__dirname, '..', '..', chemin), 'utf8');
    // [\s/] après le nom : distingue une vraie balise JSX ("<TextInput ref=..." ou
    // "<TextInput />") d'un simple type générique ("useRef<TextInput>(null)"), qui n'a jamais
    // d'espace avant le ">" fermant — connexion.tsx importe TextInput uniquement pour ce type.
    expect(source).not.toMatch(/<TextInput[\s/]/);
  });
});
