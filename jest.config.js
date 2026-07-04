module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [
    '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
  ],
  moduleNameMapper: {
    '^@react-native-google-signin/google-signin/jest/build/jest/setup$':
      '<rootDir>/node_modules/@react-native-google-signin/google-signin/jest/build/jest/setup.js',
  },
}
