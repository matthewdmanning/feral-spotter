import { PermissionStatus } from 'expo-media-library'
import { isUsable } from '../gallerySavePermission'

// SDK 56 has no supplied media-library class mock. Fake only its native
// classes so the public JS exports, including PermissionStatus, stay real.
jest.mock('expo-media-library', () => {
  const nativeModulePath = require
    .resolve('expo-media-library/package.json')
    .replace('package.json', 'src/ExpoMediaLibraryNext.ts')
  jest.doMock(nativeModulePath, () => ({
    __esModule: true,
    default: { Query: class {}, Asset: class {}, Album: class {} },
  }))
  return jest.requireActual('expo-media-library')
})

describe('gallerySavePermission.isUsable (#358)', () => {
  it('is usable when granted', () => {
    expect(
      isUsable({
        status: PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: 'never',
      }),
    ).toBe(true)
  })

  it('gates when denied', () => {
    expect(
      isUsable({
        status: PermissionStatus.DENIED,
        granted: false,
        canAskAgain: true,
        expires: 'never',
      }),
    ).toBe(false)
  })

  it('gates when undetermined', () => {
    expect(
      isUsable({
        status: PermissionStatus.UNDETERMINED,
        granted: false,
        canAskAgain: true,
        expires: 'never',
      }),
    ).toBe(false)
  })
})
