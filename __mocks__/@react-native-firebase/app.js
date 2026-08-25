// Manual Jest mock — @react-native-firebase/app's native module isn't
// available under Jest. Statically imported by src/lib/upload/firebaseUpload.ts
// (and transitively by firebaseAuthProvider.ts), so the real package must
// never load in tests.
//
// The Firebase Local Emulator Suite does NOT replace this mock and never
// will: the emulator swaps out the *backend* a native module talks to, but
// under Jest there is no native module and no bridge to talk over at all.
// Emulator mode (EXPO_PUBLIC_USE_FIREBASE_EMULATOR) is a full-app
// test-drive concern only. For a Node-runnable test that needs real
// emulator responses, use the __tests__/rules/ lane instead — see
// docs/agents/backend.md. Do not delete these mocks.
module.exports = {
  getApp: jest.fn(() => ({})),
}
