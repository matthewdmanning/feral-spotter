/**
 * Camera capture orchestration for the VisionCamera-backed paths.
 *
 * Owns only what is specific to VisionCamera: device selection, the photo
 * output, capture modes including burst, and this path's telemetry. Everything
 * around a capture — captured photo state, upload, gallery save, screen chrome
 * state, navigation — comes from useCapturedPhotoWorkflow.
 */

import { useCapturedPhotoWorkflow } from '@/src/hooks/useCapturedPhotoWorkflow'
import { useIosIdentificationCapture } from '@/src/hooks/useIosIdentificationCapture'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { captureEvent, EVENTS } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import { startLocationCapture } from '@/src/lib/location'
import type { SubmissionPhoto } from '@/src/types'
import { type FlashListRef } from '@shopify/flash-list'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, type ViewStyle } from 'react-native'
import type { useAnimatedStyle } from 'react-native-reanimated'
import {
  useCameraDevice,
  type CameraPhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera'

type FlashMode = 'off' | 'on' | 'auto'

export type CaptureMode = 'single' | 'burst'
export type { FlashMode }

export interface CameraCaptureResult {
  device: ReturnType<typeof useCameraDevice>
  cameraRef: React.RefObject<CameraRef | null>
  photoOutput: CameraPhotoOutput
  isActive: boolean
  enableLowLightBoost: boolean
  capturedPhotos: SubmissionPhoto[]
  flashMode: FlashMode
  isTakingPhoto: boolean
  captureMode: CaptureMode
  flashOverlayStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>
  listRef: React.RefObject<FlashListRef<SubmissionPhoto> | null>
  renderItem: (info: {
    item: SubmissionPhoto
    index: number
  }) => React.ReactElement
  keyExtractor: (item: SubmissionPhoto) => string
  handleTakePhoto: () => Promise<void>
  handleCameraConfigured: () => void
  setCaptureMode: (mode: CaptureMode) => void
  cycleFlash: () => void
  flipCamera: () => void
  handleDone: () => void
  handleClose: () => void
}

export function useCameraCapture(): CameraCaptureResult {
  const improvedCaptureSetting = useSettingsStore(
    (s) => s.settings.improved_camera_capture === true,
  )
  const performanceChecks = useSettingsStore(
    (s) => s.settings.camera_performance_checks === true,
  )
  const improvedCapture = Platform.OS === 'android' && improvedCaptureSetting

  const { user } = useAuth()

  const {
    isActive,
    capturedPhotos,
    listRef,
    renderItem,
    keyExtractor,
    flashMode,
    cycleFlash,
    position: cameraPosition,
    flipCamera,
    flashOverlayStyle,
    triggerFlash,
    persistCapturedPhoto,
    startPhotoUpload,
    flushGallerySaves,
    handleDone,
    handleClose,
  } = useCapturedPhotoWorkflow()

  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('single')

  const device = useCameraDevice(cameraPosition)
  const cameraRef = useRef<CameraRef>(null)

  const fallbackQualityPrioritization =
    captureMode === 'burst' || improvedCapture
      ? device?.supportsSpeedQualityPrioritization
        ? 'speed'
        : 'balanced'
      : undefined

  const {
    photoOutput,
    handleCameraConfigured,
    iosIdentificationEnabled,
    effectiveQualityPrioritization,
  } = useIosIdentificationCapture(
    device,
    flashMode,
    fallbackQualityPrioritization,
  )

  const enableLowLightBoost =
    improvedCapture && Boolean(device?.supportsLowLightBoost)
  const burstStopRequested = useRef(false)
  // Mirrors isTakingPhoto so handleTakePhoto can read it without listing state
  // it sets itself as a dependency, which recreated the callback twice per
  // capture and re-rendered the shutter.
  const isTakingPhotoRef = useRef(false)

  const capturePipeline = iosIdentificationEnabled
    ? 'ios_identification'
    : improvedCapture
      ? 'improved'
      : 'legacy'
  const cameraVariant = iosIdentificationEnabled
    ? `ios_identification_${captureMode}`
    : improvedCapture
      ? `device_aware_${captureMode}`
      : `tap_${captureMode}`

  const handleTakePhoto = useCallback(async () => {
    if (captureMode === 'burst' && isTakingPhotoRef.current) {
      burstStopRequested.current = true
      return
    }
    if (isTakingPhotoRef.current) return

    isTakingPhotoRef.current = true
    setIsTakingPhoto(true)
    burstStopRequested.current = false

    triggerFlash()

    const sequenceStartedAt = performanceChecks ? Date.now() : null
    let completedPhotoCount = 0

    try {
      do {
        const shutterTime = new Date().toISOString()
        const captureStartedAt = performanceChecks ? Date.now() : null
        const photo = await photoOutput.capturePhoto(
          { flashMode, enableShutterSound: true },
          {},
        )
        const capturedAt = performanceChecks ? Date.now() : null

        let submission: SubmissionPhoto
        try {
          const filePath = await photo.saveToTemporaryFileAsync()
          submission = persistCapturedPhoto(
            {
              uri: `file://${filePath}`,
              width: photo.width,
              height: photo.height,
            },
            shutterTime,
          )
        } finally {
          photo.dispose()
        }

        const persistedAt = performanceChecks ? Date.now() : null
        completedPhotoCount += 1

        captureEvent(EVENTS.PHOTO_CAPTURED, {
          flash_mode: flashMode,
          photo_width: submission.width,
          photo_height: submission.height,
          capture_mode: captureMode,
          capture_pipeline: capturePipeline,
          quality_prioritization: effectiveQualityPrioritization ?? 'default',
          low_light_boost: enableLowLightBoost,
          ...(performanceChecks &&
          captureStartedAt !== null &&
          capturedAt !== null &&
          persistedAt !== null
            ? {
                camera_performance_checks: true,
                camera_backend: 'visioncamera',
                camera_variant: cameraVariant,
                camera_platform: Platform.OS,
                capture_duration_ms: capturedAt - captureStartedAt,
                temporary_file_save_duration_ms: persistedAt - capturedAt,
                capture_pipeline_duration_ms: persistedAt - captureStartedAt,
              }
            : {}),
        })

        startPhotoUpload(submission, user?.uid)
      } while (captureMode === 'burst' && !burstStopRequested.current)

      if (captureMode === 'burst') {
        captureEvent(EVENTS.CAMERA_CAPTURE_SEQUENCE_COMPLETED, {
          capture_mode: captureMode,
          photo_count: completedPhotoCount,
          capture_pipeline: capturePipeline,
          quality_prioritization: effectiveQualityPrioritization ?? 'default',
          low_light_boost: enableLowLightBoost,
          ...(performanceChecks && sequenceStartedAt !== null
            ? {
                camera_performance_checks: true,
                camera_backend: 'visioncamera',
                camera_variant: cameraVariant,
                camera_platform: Platform.OS,
                duration_ms: Date.now() - sequenceStartedAt,
              }
            : {}),
        })
      }
    } catch (err) {
      console.error('[useCameraCapture] takePhoto:', err)
      captureEvent(EVENTS.PHOTO_CAPTURE_FAILED, {
        error: err instanceof Error ? err.message : String(err),
        capture_mode: captureMode,
        completed_photo_count: completedPhotoCount,
        capture_pipeline: capturePipeline,
        quality_prioritization: effectiveQualityPrioritization ?? 'default',
        low_light_boost: enableLowLightBoost,
        ...(performanceChecks && sequenceStartedAt !== null
          ? {
              camera_performance_checks: true,
              camera_backend: 'visioncamera',
              camera_variant: cameraVariant,
              camera_platform: Platform.OS,
              elapsed_ms: Date.now() - sequenceStartedAt,
            }
          : {}),
      })
    } finally {
      burstStopRequested.current = true
      isTakingPhotoRef.current = false
      setIsTakingPhoto(false)
      // Gallery writes happen here, after the sequence, not inside the loop:
      // awaiting MediaLibrary per frame bounded the burst rate by gallery I/O.
      void flushGallerySaves()
    }
  }, [
    cameraVariant,
    captureMode,
    capturePipeline,
    effectiveQualityPrioritization,
    enableLowLightBoost,
    flashMode,
    flushGallerySaves,
    performanceChecks,
    persistCapturedPhoto,
    photoOutput,
    startPhotoUpload,
    triggerFlash,
    user,
  ])

  useEffect(() => {
    if (!isActive) burstStopRequested.current = true
  }, [isActive])

  const cameraOpenedAt = useRef<number | null>(null)
  const hasReportedInitialDevice = useRef(false)

  useEffect(() => {
    cameraOpenedAt.current = performanceChecks ? Date.now() : null
  }, [performanceChecks])

  useEffect(() => {
    if (!device || hasReportedInitialDevice.current) return
    const openedAt = cameraOpenedAt.current
    hasReportedInitialDevice.current = true
    captureEvent(EVENTS.CAMERA_DEVICE_READY, {
      ...(performanceChecks && openedAt !== null
        ? {
            camera_performance_checks: true,
            camera_backend: 'visioncamera',
            camera_variant: cameraVariant,
            camera_platform: Platform.OS,
            ready_duration_ms: Date.now() - openedAt,
          }
        : {}),
      camera_position: cameraPosition,
      physical_device_count: device.physicalDevices.length,
      supports_low_light_boost: device.supportsLowLightBoost,
      supports_photo_hdr: device.supportsPhotoHDR,
      supports_speed_quality_prioritization:
        device.supportsSpeedQualityPrioritization,
      min_zoom: device.minZoom,
      max_zoom: device.maxZoom,
      capture_pipeline: capturePipeline,
      quality_prioritization: effectiveQualityPrioritization ?? 'default',
      low_light_boost: enableLowLightBoost,
    })
  }, [
    cameraPosition,
    cameraVariant,
    capturePipeline,
    device,
    effectiveQualityPrioritization,
    enableLowLightBoost,
    performanceChecks,
  ])

  useEffect(() => {
    captureEvent(EVENTS.CAMERA_OPENED)
    if (__DEV__)
      console.log(
        '[location] consent hydrated:',
        useConsentStore.persist.hasHydrated(),
      )
    void startLocationCapture()
  }, [])

  return {
    device,
    cameraRef,
    photoOutput,
    isActive,
    enableLowLightBoost,
    capturedPhotos,
    flashMode,
    isTakingPhoto,
    captureMode,
    flashOverlayStyle,
    listRef,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    handleCameraConfigured,
    setCaptureMode,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  }
}
