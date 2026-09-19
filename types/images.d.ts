// Declaration d'ambiance pour importer une image statique locale par `import` (ex.
// app/index.tsx : `import x from '../assets/marque/splash-logo-clair.png'`). Premiere fois que
// le depot en a besoin -- partout ailleurs, les images passent par EmplacementImage (source
// distante) ou par des chemins SVG ecrits a la main. Sans ce fichier, `tsc` ne sait pas quel
// type donner a un module `.png` et refuse la compilation (TS2307) ; Metro, lui, sait deja
// resoudre ces fichiers a l'execution.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const source: ImageSourcePropType;
  export default source;
}
