// Separate lane: these tests require loopback Auth, Firestore, and Storage emulators.
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/organizations/emulator-tests/**/*.test.ts'],
  testTimeout: 30000,
}
