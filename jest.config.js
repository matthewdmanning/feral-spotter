module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
  ],
  moduleNameMapper: {
    '^@react-native-google-signin/google-signin/jest/build/jest/setup$':
      '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
    '^react-native-permissions$':
      '<rootDir>/node_modules/react-native-permissions/dist/commonjs/extras/mock.js',
  },
  // ts-ailiot is a nested npm project. Crawling it makes jest-haste-map see a
  // second package.json and its node_modules, which produces naming collisions.
  modulePathIgnorePatterns: ['<rootDir>/ts-ailiot/'],
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.styles.{ts,tsx}',
  ],
}
