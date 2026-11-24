module.exports = {
  ...require('./jest.firebase'),
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
}
