/* global jest */
/**
 * Global test setup.
 *
 * AsyncStorage is mocked here rather than in each suite: useUIStore (which
 * every dialog now routes through) persists through it, so any screen or
 * hook that raises a dialog pulls the native module in transitively. Suites
 * that already mock it locally are unaffected.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// Same reason as above: src/lib/cache/storage.ts constructs an MMKV instance
// at module load, and useUIStore imports it. Mirrors the stub the suites
// that already reached this code path declare for themselves.
jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))
