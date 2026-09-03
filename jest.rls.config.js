// Configuration Jest dediee au banc RLS (src/test/rls.banc.ts, npm run test:rls).
//
// Volontairement separee de jest.config.js : elle N'ETEND PAS le prereglage jest-expo. Ce
// prereglage charge des mocks de modules natifs React Native (jest-expo/src/preset/setup.js
// require('react-native/Libraries/BatchedBridge/NativeModules')), ce qui declenche au passage
// les polyfills globaux de React Native (InitializeCore) et remplace global.fetch par
// l'implementation React Native, adossee au module natif "Networking" — mocke en une fonction
// vide sous Jest (@react-native/jest-preset/jest/mocks/NativeModules.js). Consequence
// observee : sous jest-expo, TOUT appel fetch() reussit silencieusement avec une reponse
// vide (status undefined, texte undefined), meme "@jest-environment node" en tete de fichier
// ne change rien — setupFiles s'execute avant le code du test, dans son environnement, quel
// qu'il soit.
//
// Ce banc n'a rien a voir avec React Native : c'est un test d'integration HTTP contre un vrai
// serveur Supabase. Il lui faut le vrai fetch de Node (Node 22, via undici), jamais celui de
// React Native — d'ou cette configuration minimale, sans aucun setupFile.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/rls.banc.ts'],
  // Aucun babel.config.js au depot (jest-expo le fournissait implicitement) : ce fichier est
  // du TypeScript pur, il n'a besoin que d'un retrait des types, jamais d'une transformation
  // vers une cible ancienne — il s'execute directement sous Node.
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        presets: ['@babel/preset-typescript'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
};
