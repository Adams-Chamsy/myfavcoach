const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

const HEX_COLOR = String.raw`^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`;
const hexColorMessage =
  'Couleur hexadecimale en dur interdite ici : passe par un token de src/theme.';

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
];
