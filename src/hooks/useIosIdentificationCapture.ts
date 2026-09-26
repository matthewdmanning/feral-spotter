import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import {
  configureIosCameraForIdentification,
  restoreIosAutomaticCapture,
} from '@/modules/ios-camera-optimizer/src/IosCameraOptimizerModule'
import { useCallback, useEffect, useMemo } from 'react'
import { Platform } from 'react-native'
import {
  usePhotoOutput,
  type CameraDevice,
  type CameraPhotoOutput,
} from 'react-native-vision-camera'

type FlashMode = 'off' | 'on' | 'auto'

interface IosIdentificationCaptureResult {
  photoOutput: CameraPhotoOutput
  handleCameraConfigured: () => void
}

export function useIosIdentificationCapture(
  device: CameraDevice | undefined,
  flashMode: FlashMode,
): IosIdentificationCaptureResult {
  const enabled = useSettingsStore(
    (s) =>
      Platform.OS === 'ios' &&
      s.settings.ios_improved_camera_capture === true,
  )

  const targetPhotoResolution = useMemo(() => {
    if (!enabled || !device) return undefined

    const resolutions = device.getSupportedResolutions('photo')
    if (resolutions.length === 0) return undefined

    return resolutions.reduce((largest, candidate) =>
      candidate.width * candidate.height > largest.width * largest.height
        ? candidate
        : largest,
    )
  }, [device, enabled])

  const qualityPrioritization = enabled
    ? device?.supportsSpeedQualityPrioritization
      ? 'speed'
      : 'balanced'
    : undefined

  const photoOutput = usePhotoOutput(
    enabled
      ? {
          targetResolution: targetPhotoResolution,
          quality: 1,
          qualityPrioritization,
        }
      : undefined,
  )

  const handleCameraConfigured = useCallback(() => {
    if (!enabled || !device) return
    void configureIosCameraForIdentification(device.id).catch((error) => {
      console.error('[useIosIdentificationCapture] configure:', error)
    })
  }, [device, enabled])

  useEffect(() => {
    if (!enabled || !device) return

    const deviceId = device.id
    return () => {
      void restoreIosAutomaticCapture(deviceId).catch((error) => {
        console.error('[useIosIdentificationCapture] restore:', error)
      })
    }
  }, [device, enabled])

  useEffect(() => {
    if (!enabled) return

    void photoOutput
      .prepareSettings([{ flashMode, enableShutterSound: true }])
      .catch((error) => {
        if (__DEV__)
          console.warn('[useIosIdentificationCapture] prepare:', error)
      })
  }, [enabled, flashMode, photoOutput])

  return { photoOutput, handleCameraConfigured }
}
