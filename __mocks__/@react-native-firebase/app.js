// Manual Jest mock — @react-native-firebase/app's native module isn't
// available under Jest. Statically imported by src/lib/upload/firebaseUpload.ts
// (and transitively by firebaseAuthProvider.ts), so the real package must
// never load in tests.
module.exports = {
  getApp: jest.fn(() => ({})),
}
