module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
  ],
  moduleNameMapper: {
    '^@react-native-google-signin/google-signin/jest/build/jest/setup$':
      '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
  },
  // ts-ailiot is a nested npm project. Crawling it makes jest-haste-map see a
  // second package.json and its node_modules, which produces naming collisions.
  modulePathIgnorePatterns: ['<rootDir>/ts-ailiot/'],
  // Rules tests need plain Node + @firebase/rules-unit-testing, not the RN
  // preset — run separately via jest.rules.config.js / npm run test:rules.
  // (Jest's own node_modules default is dropped if this array isn't repeated.)
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/rules/'],
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.styles.{ts,tsx}',
  ],
}
