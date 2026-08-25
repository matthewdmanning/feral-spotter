// Manual Jest mock — @react-native-firebase/storage's native module isn't
// available under Jest. Statically imported by
// src/lib/upload/firebaseUpload.ts, so the real package must never load in
// tests.
//
// The Firebase Local Emulator Suite does NOT replace this mock and never
// will: the emulator swaps out the *backend* a native module talks to, but
// under Jest there is no native module and no bridge to talk over at all.
// Emulator mode (EXPO_PUBLIC_USE_FIREBASE_EMULATOR) is a full-app
// test-drive concern only. For a Node-runnable test that needs real
// emulator responses, use the __tests__/rules/ lane instead — see
// docs/agents/backend.md. Do not delete these mocks.
module.exports = {
  getStorage: jest.fn(() => ({})),
  connectStorageEmulator: jest.fn(),
  ref: jest.fn(() => ({})),
  putFile: jest.fn(() => {
    const task = Promise.resolve()
    task.on = jest.fn()
    return task
  }),
  getDownloadURL: jest.fn(() =>
    Promise.resolve('https://example.com/mock.jpg'),
  ),
  uploadString: jest.fn(() => Promise.resolve()),
  getMetadata: jest.fn(() =>
    Promise.resolve({ timeCreated: '2026-01-01T00:00:00.000Z' }),
  ),
  updateMetadata: jest.fn(() => Promise.resolve({})),
}
