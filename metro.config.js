// Config Metro, chargee par le CLI Expo.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const blockListExistant = config.resolver.blockList;
const blockListExistantEnListe = Array.isArray(blockListExistant)
  ? blockListExistant
  : [blockListExistant];

// Exclusion permanente (dev ET production) : expo-router traite tout fichier .tsx sous app/
// comme une route candidate via require.context (src/_ctx.js), fichiers de test compris — sans
// ca, Metro tente d'empaqueter app/*.test.tsx comme un ecran et plante sur les globals Jest
// (expect, jest.mock...) qui n'existent pas hors test. Rien a voir avec le mecanisme de
// production ci-dessous : necessaire dans les deux modes.
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
