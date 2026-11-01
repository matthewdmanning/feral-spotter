import * as ImagePicker from 'expo-image-picker'
import { isUsable } from '../libraryPermission'

describe('libraryPermission.isUsable (#358)', () => {
  it('is usable when fully granted', () => {
    expect(
      isUsable({
        status: ImagePicker.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: 'never',
      }),
    ).toBe(true)
  })

  it('is usable when limited (iOS "Select Photos") even though status is not granted', () => {
    expect(
      isUsable({
        status: ImagePicker.PermissionStatus.UNDETERMINED,
        granted: false,
        canAskAgain: true,
        expires: 'never',
        accessPrivileges: 'limited',
      }),
    ).toBe(true)
  })

  it('gates when denied and not limited — #249, decline is not merely absence of yes', () => {
    expect(
      isUsable({
        status: ImagePicker.PermissionStatus.DENIED,
        granted: false,
        canAskAgain: true,
        expires: 'never',
      }),
    ).toBe(false)
  })
})
