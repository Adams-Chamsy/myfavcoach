// Config Metro, chargee par le CLI Expo.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const blockListExistant = config.resolver.blockList;
const blockListExistantEnListe = Array.isArray(blockListExistant)
  ? blockListExistant
  : [blockListExistant];

// Exclusion permanente (dev ET production) : expo-router traite tout fichier .tsx sous app/
// comme une route candidate via require.context (node_modules/expo-router/_ctx*.js), fichiers de
// test compris — sans ca, naviguer vers une route generee a partir d'un fichier de test (ex.
// "/index.test") ferait tenter a Metro de charger ce module et planterait sur les globals Jest
// (expect, jest.mock...) qui n'existent pas hors test.
//
// Ce que ca NE protege PAS : la construction de l'arbre de routes elle-meme (qui fichier existe,
// lequel est un layout) tourne avant que blockList n'intervienne — verifie empiriquement, un
// fichier bloque y apparait quand meme. C'est sans consequence pour un fichier de route normal
// (il finit simplement en route fantome qui ne charge jamais de contenu reel, comme "/index.test"
// ci-dessus), mais c'est fatal pour un fichier nomme "_layout.test.tsx" : expo-router reconnait
// tout nom commencant par le segment exact "_layout" avant le premier point comme une variante
// de layout (meme mecanisme que "_layout.ios.tsx"), donc "_layout.test.tsx" et "_layout.tsx"
// s'enregistrent tous deux comme layout de la meme route et expo-router plante des le demarrage
// ("The layouts ... conflict on the route"), y compris en production. Solution : le test de
// _layout.tsx s'appelle app/_layout-racine.test.tsx (tiret, pas point) pour ne jamais matcher ce
// segment — voir le commentaire en tete de ce fichier et docs/dette.md.
const blockListTests = /\/app\/.*\.test\.tsx?$/;

// Exclusion propre a la production (docs/ecrans/L0-00-galerie-systeme.md, critere 2) :
// resolver.blockList retire app/_galerie.tsx de la carte de fichiers de Metro avant meme que
// expo-router n'enumere les routes, donc la route n'existe nulle part dans le bundle, pas
// seulement masquee a l'ecran. Verifie empiriquement : `npx expo export -p web` definit
// process.env.NODE_ENV = "production" pour le processus qui charge ce fichier ; `expo start`
// (developpement) ne le fait pas.
const blockListGalerie = /\/app\/_galerie\.tsx$/;

config.resolver.blockList = [
  ...blockListExistantEnListe,
  blockListTests,
  ...(process.env.NODE_ENV === 'production' ? [blockListGalerie] : []),
];

module.exports = config;
