/**
 * lib/permissions/cameraPermission.ts
 * Camera permission gate (react-native-vision-camera), for consent's
 * imperative request flow (#358). camera/index.tsx's own live gate uses
 * vision-camera's useCameraPermission() hook directly -- already a single
 * clean call, nothing to consolidate there.
 */
import { VisionCamera, type PermissionStatus } from 'react-native-vision-camera'
import type { PermissionGate } from './types'

// react-native-vision-camera reports a first-time "Don't allow" as
// 'not-determined' (still askable), not 'denied' — Android only escalates to
// 'denied' on a second denial (or "don't ask again"). 'not-determined' must
// gate too or a first-time full denial bypasses the gate entirely (#66,
// #237 — ported from react-native-permissions's identical DENIED/BLOCKED
// split). 'restricted' (e.g. parental controls) gates too — the camera isn't
// usable without it either way.
export function isUsable(status: PermissionStatus): boolean {
  return status === 'authorized'
}

export const cameraPermission: PermissionGate = {
  async check() {
    return isUsable(VisionCamera.cameraPermissionStatus)
  },
  async request() {
    // No check-first shortcut here, unlike the other adapters: the
    // synchronous cameraPermissionStatus getter is documented (and tested)
    // as unreliable around a request in flight, so the only trustworthy
    // signal is the boolean requestCameraPermission() itself resolves with.
    return VisionCamera.requestCameraPermission()
  },
}
