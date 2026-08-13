// Separate from jest.config.js: rules tests run @firebase/rules-unit-testing
// against the Local Emulator Suite in plain Node, not the RN/jest-expo
// preset the rest of the app's tests use.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/rules/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
}
