import { PermissionStatus } from 'expo-media-library'
import { isUsable } from '../gallerySavePermission'

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
