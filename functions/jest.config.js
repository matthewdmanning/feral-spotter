module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  // jose (via firebase-admin -> jwks-rsa) ships ESM only; transpile it to CommonJS.
  transformIgnorePatterns: ['/node_modules/(?!jose/)'],
}
