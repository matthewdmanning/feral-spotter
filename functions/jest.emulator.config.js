// Separate lane: these tests require loopback Auth, Firestore, and Storage emulators.
module.exports = {
  ...require('./jest.config'),
  testMatch: [
    '<rootDir>/src/organizations/emulator-tests/**/*.test.ts',
    '<rootDir>/src/uploads/emulator-tests/**/*.test.ts',
    '<rootDir>/src/backups/emulator-tests/**/*.test.ts',
  ],
  testTimeout: 30000,
}
