/**
 * hooks/useCameraAccess.ts
 * Camera OS-permission status via react-native-vision-camera's own permission
 * API — the same library that owns the camera hardware, so tracked status
 * can't drift from what the device actually grants (#243).
 */
import { useCallback } from 'react'
import { Linking } from 'react-native'
import { useCameraPermission } from 'react-native-vision-camera'

export interface CameraAccessResult {
  hasPermission: boolean
  requestPermission: () => Promise<void>
  openSettings: () => Promise<void>
}

export function useCameraAccess(): CameraAccessResult {
  const { hasPermission, requestPermission: requestVisionCameraPermission } =
    useCameraPermission()

  const requestPermission = useCallback(async () => {
    await requestVisionCameraPermission()
  }, [requestVisionCameraPermission])

  return {
    hasPermission,
    requestPermission,
    openSettings: () => Linking.openSettings(),
  }
}
