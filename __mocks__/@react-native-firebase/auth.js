/* global jest */

// Manual Jest mock — @react-native-firebase/auth's native module isn't
// available under Jest. Keep the application provider real while replacing
// the SDK operations that require the native platform.
//
// The Firebase Local Emulator Suite does NOT replace this mock and never
// will: the emulator swaps out the *backend* a native module talks to, but
// under Jest there is no native module and no bridge to talk over at all.
// Emulator mode (EXPO_PUBLIC_USE_FIREBASE_EMULATOR) is a full-app
// test-drive concern only. For a Node-runnable test that needs real
// emulator responses, use the __tests__/rules/ lane instead — see
// docs/agents/backend.md. Do not delete these mocks.
module.exports = {
  getAuth: jest.fn(() => ({ currentUser: null })),
  connectAuthEmulator: jest.fn(),
  signInWithCredential: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn() },
  FacebookAuthProvider: { credential: jest.fn() },
  OAuthProvider: jest.fn(() => ({ credential: jest.fn() })),
  onAuthStateChanged: jest.fn(() => () => {}),
  verifyBeforeUpdateEmail: jest.fn(),
  signOut: jest.fn(),
}
