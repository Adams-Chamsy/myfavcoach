module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Sans ce resolveur, react-native-worklets charge son module natif meme sous Jest et
  // plante (aucun natif charge en test) : voir node_modules/react-native-worklets/jest.
  resolver: 'react-native-worklets/jest/resolver.js',
  // Defaut Jest (5000 ms) trouve trop juste en CI : reproduit en clonant f73044c dans un
  // worktree propre (npm ci a froid, aucun cache Jest/Metro) — neuf suites basees sur
  // renderRouter (deja documentees fragiles, CLAUDE.md §8) ont depasse 5000 ms a froid alors
  // qu'elles passent en ~1 s chacune une fois le cache chaud. Meme cause que le depassement de
  // src/test/accessibilite.test.tsx (fixe la meme session avec un testTimeout explicite) : la
  // suite s'est alourdie lot apres lot, la marge par defaut ne suffit plus des le premier essai
  // a froid. 15 s, memes marge que ce fichier-la, jamais mesure au-dela de 2 s meme a froid ici.
  testTimeout: 15000,
  // Trouve dans le meme worktree de reproduction : meme apres le testTimeout ci-dessus, DEUX
  // suites (app/(onboarding)/devenir-coach.test.tsx, app/(compte)/confidentialite.test.tsx)
  // echouaient encore, de facon deterministe, avec "The current testing environment is not
  // configured to support act(...)" -- jamais un depassement de delai. `--runInBand` (un seul
  // worker) les fait passer a coup sur ; `--maxWorkers=2` aussi, en gardant un peu de
  // parallelisme. Le parallelisme par defaut de Jest (base sur le nombre de coeurs) sature
  // suffisamment la machine pour perturber le suivi interne de act() de React -- pas une fuite
  // d'etat entre fichiers precise, une contention CPU reelle une fois la suite assez grosse.
  maxWorkers: 2,
};
