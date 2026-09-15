/**
 * lib/permissions/gallerySavePermission.ts
 * Gallery-save (add-only) permission gate (expo-media-library), for
 * useCameraCapture's "keep captured photos on device" path (#358).
 * writeOnly (true) requests add-only access, matching app.json's
 * savePhotosPermission config — unlike a full read request, it has no
 * Android 14+ "Select photos" partial-access flow to surface (#140), since
 * this path never reads the library.
 */
import {
  getPermissionsAsync,
  PermissionStatus,
  requestPermissionsAsync,
  type PermissionResponse,
} from 'expo-media-library'
import type { PermissionGate } from './types'

export function isUsable(response: PermissionResponse): boolean {
  return response.status === PermissionStatus.GRANTED
}

export const gallerySavePermission: PermissionGate = {
  async check() {
    return isUsable(await getPermissionsAsync(true))
  },
  async request() {
    if (isUsable(await getPermissionsAsync(true))) return true
    return isUsable(await requestPermissionsAsync(true))
  },
}
