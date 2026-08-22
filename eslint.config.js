const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

const HEX_COLOR = String.raw`^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`;
const hexColorMessage =
  'Couleur hexadecimale en dur interdite ici : passe par un token de src/theme.';

const mouvementMessage =
  "N'importe pas mouvement/mouvementReduit directement : passe par useMouvementReduit() " +
  '(src/theme/fournisseur.tsx), le seul point de lecture autorise. Un composant qui lit ' +
  'mouvement directement ignore le reglage systeme de mouvement reduit. Voir docs/design-system.md §4.';

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'ios/**',
      'android/**',
      'coverage/**',
      'maquettes/**',
      // artefact ecrit par le serveur Expo tant qu'aucune route reelle n'existe, voir docs/dette.md
      'app/index.tsx',
    ],
  },
  ...expoConfig,
  prettierConfig,
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HEX_COLOR}/]`,
          message: hexColorMessage,
        },
        {
          selector: `TemplateElement[value.cooked=/${HEX_COLOR}/]`,
          message: hexColorMessage,
        },
      ],
    },
  },
  {
    // Seul useMouvementReduit() (src/theme/fournisseur.tsx) a le droit de lire ces deux
    // groupes de tokens.ts. Les tests sont exclus : ils verifient des appels contre la valeur
    // brute du token (ex. expect(withTiming).toHaveBeenCalledWith(mouvement.valeur, ...)),
    // ce qui n'est pas le bug que cette regle empeche.
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/theme/tokens',
              importNames: ['mouvement', 'mouvementReduit'],
              message: mouvementMessage,
            },
          ],
        },
      ],
    },
  },
];
