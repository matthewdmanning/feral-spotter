// Manual Jest mock — react-native-fbsdk-next wraps native Facebook SDKs that
// aren't available under Jest. FacebookSignIn.ts imports it at module load, so
// the real package must never resolve in tests.
module.exports = {
  LoginManager: {
    logInWithPermissions: jest.fn(() => Promise.resolve({ isCancelled: true })),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(() => Promise.resolve(null)),
  },
  AuthenticationToken: {
    getAuthenticationTokenIOS: jest.fn(() => Promise.resolve(null)),
  },
}
