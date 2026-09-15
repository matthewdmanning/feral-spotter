import { PermissionStatus } from 'expo-media-library'
import { isUsable } from '../gallerySavePermission'

// expo-media-library's module-scope class setup only resolves inside a real
// native runtime — mocked here purely so the import doesn't throw; isUsable
// itself never touches the native module.
jest.mock('expo-media-library', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
}))

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
