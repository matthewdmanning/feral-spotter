// Manual Jest mock — @react-native-firebase/auth's native module isn't
// available under Jest. Only src/lib/auth/index.ts's Jest branch (the dev
// stub) actually runs in tests, but firebaseAuthProvider.ts is still
// statically imported by that module, so the real package must never load.
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
  signOut: jest.fn(),
}
