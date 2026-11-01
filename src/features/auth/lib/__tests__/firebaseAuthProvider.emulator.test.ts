// Exercises createFirebaseAuthProvider directly (not the index.ts-exported
// authProvider), since index.ts always picks the dev stub under Jest —
// bypassing that lets us assert the real provider's emulator-connect
// behavior in isolation.
//
// USE_FIREBASE_EMULATOR is a module-level const baked in at first import, so
// asserting both the on/off branches needs a fresh module per test —
// jest.resetModules() + require() (not `import`, which needs
// --experimental-vm-modules to be dynamic under this project's Jest/Babel
// CJS setup) after each process.env change.
//
// The fetch spy is (re-)installed after each require(), not in beforeEach —
// this file's module graph pulls in @react-native-google-signin/google-signin,
// which re-registers global.fetch's lazy polyfill getter as a side effect of
// being freshly required post-resetModules(), clobbering a spy set up any
// earlier.
const ORIGINAL_ENV = process.env

function spyOnFetch() {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(undefined as unknown as Response)
}

describe('createFirebaseAuthProvider emulator wiring', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR
    delete process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('connects to the Auth emulator at the configured host when the flag is set', () => {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true'
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = 'test-host'

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { createFirebaseAuthProvider } = require('../firebaseAuthProvider')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { connectAuthEmulator } = require('@react-native-firebase/auth')
    spyOnFetch()

    createFirebaseAuthProvider()

    expect(connectAuthEmulator).toHaveBeenCalledWith(
      expect.anything(),
      'http://test-host:9099',
    )
  })

  it('defaults to localhost when no host override is set', () => {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true'

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { createFirebaseAuthProvider } = require('../firebaseAuthProvider')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { connectAuthEmulator } = require('@react-native-firebase/auth')
    spyOnFetch()

    createFirebaseAuthProvider()

    expect(connectAuthEmulator).toHaveBeenCalledWith(
      expect.anything(),
      'http://localhost:9099',
    )
  })

  it('does not connect to the emulator when the flag is unset', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { createFirebaseAuthProvider } = require('../firebaseAuthProvider')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { connectAuthEmulator } = require('@react-native-firebase/auth')
    const fetchSpy = spyOnFetch()

    createFirebaseAuthProvider()

    expect(connectAuthEmulator).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('pings the emulator to confirm it is actually reachable', () => {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true'
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = 'test-host'

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { createFirebaseAuthProvider } = require('../firebaseAuthProvider')
    const fetchSpy = spyOnFetch()

    createFirebaseAuthProvider()

    expect(fetchSpy).toHaveBeenCalledWith('http://test-host:9099')
  })

  it('logs a loud, clear error when the emulator is unreachable', async () => {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true'
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = 'test-host'

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { createFirebaseAuthProvider } = require('../firebaseAuthProvider')
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

    createFirebaseAuthProvider()
    // The reachability ping is fire-and-forget — let its rejection settle.
    await new Promise((resolve) => setImmediate(resolve))

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('unreachable'),
    )
  })
})
