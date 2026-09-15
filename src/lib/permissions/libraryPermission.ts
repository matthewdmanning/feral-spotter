/**
 * lib/permissions/libraryPermission.ts
 * Photo-library read permission gate (expo-image-picker), for
 * useLibraryPhotoPicker's check-then-request flow (#358).
 */
import * as ImagePicker from 'expo-image-picker'
import type { PermissionGate } from './types'

// Yes means yes, not merely absence of no (#249, extending the camera/location
// pattern from #66/#237/#243): a decline inside launchImageLibraryAsync() and
// backing out of the picker without choosing anything both resolve as
// `{ canceled: true }` — indistinguishable unless permission is checked
// explicitly first. `limited` (iOS "Select Photos") counts as a valid yes.
export function isUsable(
  response: ImagePicker.MediaLibraryPermissionResponse,
): boolean {
  return (
    response.status === ImagePicker.PermissionStatus.GRANTED ||
    response.accessPrivileges === 'limited'
  )
}

export const libraryPermission: PermissionGate = {
  async check() {
    return isUsable(await ImagePicker.getMediaLibraryPermissionsAsync())
  },
  async request() {
    if (isUsable(await ImagePicker.getMediaLibraryPermissionsAsync())) {
      return true
    }
    return isUsable(await ImagePicker.requestMediaLibraryPermissionsAsync())
  },
}
