const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

const HEX_COLOR = String.raw`^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$`;
const hexColorMessage =
  'Couleur hexadecimale en dur interdite ici : passe par un token de src/theme.';

const mouvementMessage =
  "N'importe pas mouvement/mouvementReduit directement : passe par useMouvementReduit() " +
  '(src/theme/fournisseur.tsx), le seul point de lecture autorise. Un composant qui lit ' +
  'mouvement directement ignore le reglage systeme de mouvement reduit. Voir docs/design-system.md §4.';

const CLE_SENSIBLE = String.raw`jeton|token|auth|sant[eé]`;
const asyncStorageMessage =
  'AsyncStorage interdit pour une cle de jeton, de session ou de donnee de sante : passe par ' +
  'src/services/trousseau/trousseau.ts (expo-secure-store). Voir CLAUDE.md §10 et ' +
  'docs/ecrans/L0-04-demarrage.md, critere 6.';

// Cles secretes (jamais publiables) des prestataires : une cle secrete Stripe (sk_test_/
// sk_live_) ou une cle service_role Supabase donne un acces total, cote serveur. Le paquet
// mobile n'expose que ce que l'appareil du client peut lire : aucune des deux ne doit jamais
// s'y trouver, meme en valeur d'exemple. Seules les cles publiables (EXPO_PUBLIC_*, cle anon
// Supabase, cle publique Stripe pk_...) sont a leur place ici.
const CLE_SECRETE = String.raw`^(sk_test_|sk_live_|service_role)`;
const cleSecreteMessage =
  'Cle secrete interdite dans le paquet mobile (sk_test_/sk_live_/service_role) : ces cles ' +
  "restent cote serveur, jamais dans l'application. Voir CLAUDE.md §10.";

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
    // src/test/contraste.test.ts verifie une fonction de calcul de contraste : elle a besoin de
    // vraies valeurs hexadecimales en entree, ce n'est pas un ecran ou un composant.
    ignores: ['src/theme/**', 'src/test/contraste.test.ts'],
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
        {
          selector: `CallExpression[callee.object.name='AsyncStorage'] Literal[value=/${CLE_SENSIBLE}/i]`,
          message: asyncStorageMessage,
        },
        {
          selector: `CallExpression[callee.object.name='AsyncStorage'] TemplateElement[value.cooked=/${CLE_SENSIBLE}/i]`,
          message: asyncStorageMessage,
        },
        {
          selector: `Literal[value=/${CLE_SECRETE}/]`,
          message: cleSecreteMessage,
        },
        {
          selector: `TemplateElement[value.cooked=/${CLE_SECRETE}/]`,
          message: cleSecreteMessage,
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
