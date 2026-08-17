module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
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
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/*.styles.{ts,tsx}',
  ],
}
