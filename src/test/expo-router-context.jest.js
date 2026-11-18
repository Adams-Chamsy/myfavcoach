/* global jest:readonly */
// renderRouter({ appDir, overrides }) retire "./" et l’extension des clés.
// Expo Router doit encore reconnaître le fichier natif spécial dans ce contexte.
jest.mock('expo-router/build/testing-library/context-stubs', () => {
  const moduleReel = jest.requireActual('expo-router/build/testing-library/context-stubs');
  return {
    ...moduleReel,
    requireContextWithOverrides(...args) {
      const contexte = moduleReel.requireContextWithOverrides(...args);
      const cles = contexte.keys;
      contexte.keys = () =>
        cles().map((cle) => (cle === '+native-intent' ? './+native-intent.tsx' : cle));
      return Object.assign(
        (cle) => contexte(cle === './+native-intent.tsx' ? '+native-intent' : cle),
        contexte,
      );
    },
  };
});
