import type { SubmissionApiPayload } from '@/src/types'

// USE_FIREBASE_EMULATOR is a module-level const baked in at first import, so
// asserting both the on/off branches needs a fresh module per test —
// jest.resetModules() + require() (not `import`, which needs
// --experimental-vm-modules to be dynamic under this project's Jest/Babel
// CJS setup) after each process.env change.
const ORIGINAL_ENV = process.env

describe('firebaseUpload emulator wiring', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
    delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR
    delete process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST
    delete process.env.EXPO_PUBLIC_UPLOADS_MOCK
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('connects to the Storage emulator exactly once, even across multiple calls, when the flag is set', async () => {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true'
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST = 'test-host'

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { uploadSubmissionMetadata } = require('../firebaseUpload')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { connectStorageEmulator } = require('@react-native-firebase/storage')

    await uploadSubmissionMetadata({} as SubmissionApiPayload, 'uid1', 'sub1')
    await uploadSubmissionMetadata({} as SubmissionApiPayload, 'uid1', 'sub2')

    expect(connectStorageEmulator).toHaveBeenCalledTimes(1)
    expect(connectStorageEmulator).toHaveBeenCalledWith(
      expect.anything(),
      'test-host',
      9199,
    )
  })

  it('does not connect to the emulator when the flag is unset', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { uploadSubmissionMetadata } = require('../firebaseUpload')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file-header comment
    const { connectStorageEmulator } = require('@react-native-firebase/storage')

    await uploadSubmissionMetadata({} as SubmissionApiPayload, 'uid1', 'sub1')

    expect(connectStorageEmulator).not.toHaveBeenCalled()
  })
})
