// Config Metro, chargee par le CLI Expo. Sert a exclure app/_galerie.tsx du bundle de
// production (docs/ecrans/L0-00-galerie-systeme.md, critere 2) : resolver.blockList retire le
// fichier de la carte de fichiers de Metro avant meme que expo-router n'enumere les routes via
// require.context (src/_ctx.js dans expo-router), donc la route n'existe nulle part dans le
// bundle, pas seulement masquee a l'ecran. Verifie empiriquement : `npx expo export -p web`
// definit process.env.NODE_ENV = "production" pour le processus qui charge ce fichier ; `expo
// start` (developpement) ne le fait pas.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.NODE_ENV === 'production') {
  const blockListExistant = config.resolver.blockList;
  const blockListExistantEnListe = Array.isArray(blockListExistant)
    ? blockListExistant
    : [blockListExistant];
  config.resolver.blockList = [...blockListExistantEnListe, /\/app\/_galerie\.tsx$/];
}

module.exports = config;
