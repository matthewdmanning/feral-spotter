module.exports = {
  preset: 'jest-expo',
  // Reanimated's resolver forces the web build of Reanimated and Worklets in
  // Jest (Reanimated 4.7 testing guide); it supersedes the Worklets-only one.
  resolver: 'react-native-reanimated/jest/resolver',
  setupFilesAfterEnv: [
    '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
    '<rootDir>/jest.setup.js',
  ],
  moduleNameMapper: {
    '^@react-native-google-signin/google-signin/jest/build/jest/setup$':
      '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
  },
  // ts-ailiot and functions/ are nested npm projects with their own
  // package.json/node_modules (functions/ has its own jest.config.js — run
  // via `npm run test:functions`, not swept into this root config).
  // Crawling them makes jest-haste-map see duplicate package.json files,
  // which produces naming collisions. .claude/worktrees/ holds full
  // checked-out copies of this repo (each with its own __mocks__/,
  // node_modules) from Claude Code's worktree feature — same duplicate-mock
  // problem, so it's excluded for the same reason.
  modulePathIgnorePatterns: [
    '<rootDir>/ts-ailiot/',
    '<rootDir>/functions/',
    '<rootDir>/.claude/worktrees/',
  ],
  // Rules tests need plain Node + @firebase/rules-unit-testing, not the RN
  // preset — run separately via jest.rules.config.js / npm run test:rules.
  // (Jest's own node_modules default is dropped if this array isn't repeated.)
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/rules/'],
  // jest-expo's list plus phosphor-react-native, which ships its icons as
  // TypeScript source (the per-icon paths the app imports, #406). Replacing
  // the option replaces the preset's whole list, so its entries are repeated.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|phosphor-react-native))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.styles.{ts,tsx}',
  ],
}
