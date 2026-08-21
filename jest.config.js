module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Sans ce resolveur, react-native-worklets charge son module natif meme sous Jest et
  // plante (aucun natif charge en test) : voir node_modules/react-native-worklets/jest.
  resolver: 'react-native-worklets/jest/resolver.js',
};
