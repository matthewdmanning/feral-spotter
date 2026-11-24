/**
 * Camera capture orchestration for the VisionCamera-backed paths.
 *
 * Owns only what is specific to VisionCamera: device selection, the photo
 * output, capture modes including burst, and this path's telemetry. Everything
 * around a capture — captured photo state, upload, gallery save, screen chrome
 * state, navigation — comes from useCapturedPhotoWorkflow.
 */

import { isAtPhotoLimit } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useCapturedPhotoWorkflow } from '@/src/features/camera-control/hooks/useCapturedPhotoWorkflow'
import { visionCameraConfig } from '@/src/features/camera-control/lib/cameraConfig'
import { useIosIdentificationCapture } from '@/src/features/camera-control/hooks/useIosIdentificationCapture'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { captureEvent, EVENTS } from '@/src/shared/analytics/analytics'
import type { SubmissionPhoto } from '@/src/shared/types'
import { type FlashListRef } from '@shopify/flash-list'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  canCapture: boolean
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

  const {
    isActive,
    canCapture,
    capturedPhotos,
    listRef,
    renderItem,
    keyExtractor,
    flashMode,
    cycleFlash,
    position: cameraPosition,
    flipCamera,
    flashOverlayStyle,
    persistCapturedPhoto,
    startPhotoUpload,
    isTakingPhoto,
    isTakingPhotoRef,
    runCapture,
    handleDone,
    handleClose,
  } = useCapturedPhotoWorkflow()

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

  const enableLowLightBoost = Boolean(device?.supportsLowLightBoost)
  const burstStopRequested = useRef(false)

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

  // Present on every timed event of this path; null when checks are off.
  const performanceProps = useMemo(
    () =>
      performanceChecks
        ? {
            camera_performance_checks: true,
            camera_backend: 'visioncamera',
            camera_variant: cameraVariant,
            camera_platform: Platform.OS,
          }
        : null,
    [cameraVariant, performanceChecks],
  )
  const pipelineProps = useMemo(
    () => ({
      capture_pipeline: capturePipeline,
      quality_prioritization: effectiveQualityPrioritization ?? 'default',
      low_light_boost: enableLowLightBoost,
    }),
    [capturePipeline, effectiveQualityPrioritization, enableLowLightBoost],
  )

  const handleTakePhoto = useCallback(async () => {
    if (!canCapture) return
    if (captureMode === 'burst' && isTakingPhotoRef.current) {
      burstStopRequested.current = true
      return
    }

    const sequenceStartedAt = performanceChecks ? Date.now() : null
    let completedPhotoCount = 0

    const capture = async () => {
      burstStopRequested.current = false
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
              cameraConfig: visionCameraConfig({
                platform: Platform.OS,
                position: cameraPosition,
                flashMode,
                shutterMode: captureMode,
                capturePipeline,
                qualityPrioritization: effectiveQualityPrioritization,
                lowLightBoost: enableLowLightBoost,
              }),
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
          ...pipelineProps,
          ...(performanceProps &&
          captureStartedAt !== null &&
          capturedAt !== null &&
          persistedAt !== null
            ? {
                ...performanceProps,
                capture_duration_ms: capturedAt - captureStartedAt,
                temporary_file_save_duration_ms: persistedAt - capturedAt,
                capture_pipeline_duration_ms: persistedAt - captureStartedAt,
              }
            : {}),
        })

        startPhotoUpload()
      } while (
        captureMode === 'burst' &&
        !burstStopRequested.current &&
        !isAtPhotoLimit()
      )

      if (captureMode === 'burst') {
        captureEvent(EVENTS.CAMERA_CAPTURE_SEQUENCE_COMPLETED, {
          capture_mode: captureMode,
          photo_count: completedPhotoCount,
          ...pipelineProps,
          ...(performanceProps && sequenceStartedAt !== null
            ? {
                ...performanceProps,
                duration_ms: Date.now() - sequenceStartedAt,
              }
            : {}),
        })
      }
    }

    await runCapture({
      capture,
      logTag: 'useCameraCapture',
      failureProps: () => ({
        capture_mode: captureMode,
        completed_photo_count: completedPhotoCount,
        ...pipelineProps,
        ...(performanceProps && sequenceStartedAt !== null
          ? {
              ...performanceProps,
              elapsed_ms: Date.now() - sequenceStartedAt,
            }
          : {}),
      }),
    })
    burstStopRequested.current = true
  }, [
    cameraPosition,
    captureMode,
    capturePipeline,
    effectiveQualityPrioritization,
    enableLowLightBoost,
    flashMode,
    isTakingPhotoRef,
    performanceChecks,
    performanceProps,
    persistCapturedPhoto,
    photoOutput,
    pipelineProps,
    runCapture,
    startPhotoUpload,
    canCapture,
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
      ...(performanceProps && openedAt !== null
        ? { ...performanceProps, ready_duration_ms: Date.now() - openedAt }
        : {}),
      camera_position: cameraPosition,
      physical_device_count: device.physicalDevices.length,
      supports_low_light_boost: device.supportsLowLightBoost,
      supports_photo_hdr: device.supportsPhotoHDR,
      supports_speed_quality_prioritization:
        device.supportsSpeedQualityPrioritization,
      min_zoom: device.minZoom,
      max_zoom: device.maxZoom,
      ...pipelineProps,
    })
  }, [cameraPosition, device, performanceProps, pipelineProps])

  useEffect(() => {
    captureEvent(EVENTS.CAMERA_OPENED)
    if (__DEV__)
      console.log(
        '[location] consent hydrated:',
        useConsentStore.persist.hasHydrated(),
      )
  }, [])

  return {
    device,
    cameraRef,
    photoOutput,
    isActive,
    canCapture,
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
