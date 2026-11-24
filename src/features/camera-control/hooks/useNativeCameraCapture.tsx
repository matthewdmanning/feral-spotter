/**
 * Camera capture orchestration for the native identification camera.
 *
 * Owns only what is specific to the native view: the view ref, the ready flag,
 * the tuning props the view takes, subject metering, and this path's telemetry.
 * Everything around a capture comes from useCapturedPhotoWorkflow, so the
 * application workflow exists once rather than once per backend.
 */

import { useCapturedPhotoWorkflow } from '@/src/features/camera-control/hooks/useCapturedPhotoWorkflow'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { CAMERA_FIELD_CONDITION } from '@/src/shared/config/constants'
import { nativeCameraConfig } from '@/src/features/camera-control/lib/cameraConfig'
import { captureEvent, EVENTS } from '@/src/shared/analytics/analytics'
import type { ImagePostprocessor } from '@/src/features/camera-control/lib/pipeline'
import type {
  NativeCameraDiagnosticEvent,
  NativeCameraReadyEvent,
  NativeIdentificationCameraRef,
  NormalizedSubjectRegion,
} from '@/modules/native-identification-camera'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

const NATIVE_CAMERA_BACKEND = Platform.OS === 'ios' ? 'avfoundation' : 'camerax'

interface NativeCameraCaptureOptions {
  postprocessor?: ImagePostprocessor
}

export function useNativeCameraCapture(
  options: NativeCameraCaptureOptions = {},
) {
  const maxDetail = useSettingsStore(
    (s) => s.settings.camera_max_detail !== false,
  )
  const motionPriority = useSettingsStore(
    (s) => s.settings.camera_motion_priority !== false,
  )
  // Compatibility prop; the native camera enables automatic low-light boost
  // whenever the device supports it.
  const disableLowLightBoost = false
  const subjectMetering = useSettingsStore(
    (s) => s.settings.camera_subject_metering === true,
  )
  // Android only: it zooms the preview there. iOS zooms the camera itself, so
  // a zoomed iOS capture is a cropped capture.
  const pinchZoom = Platform.OS === 'android'
  // Android only: the iOS view has no field capture configs.
  const fieldCondition =
    Platform.OS === 'android' ? CAMERA_FIELD_CONDITION : null
  const performanceChecks = useSettingsStore(
    (s) => s.settings.camera_performance_checks === true,
  )

  const cameraRef = useRef<NativeIdentificationCameraRef>(null)
  const cameraOpenedAt = useRef<number | null>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)

  // Flipping rebinds the native session, so the ready flag has to drop and the
  // ready-duration measurement has to restart.
  const handleBeforeFlip = useCallback(() => {
    setIsCameraReady(false)
    cameraOpenedAt.current = performanceChecks ? Date.now() : null
  }, [performanceChecks])

  const {
    isActive,
    canCapture,
    capturedPhotos,
    listRef,
    renderItem,
    keyExtractor,
    flashMode,
    cycleFlash,
    position,
    flipCamera,
    flashOverlayStyle,
    persistCapturedPhoto,
    startPhotoUpload,
    isTakingPhoto,
    runCapture,
    handleDone,
    handleClose,
  } = useCapturedPhotoWorkflow({ onBeforeFlip: handleBeforeFlip })

  // The tuning the settings requested, reported once per bind. Held in a ref so
  // every capture event can carry it without re-creating the capture callback
  // each time the camera rebinds.
  const requestedCaptureTuning = useRef<string | null>(null)

  useEffect(() => {
    cameraOpenedAt.current = performanceChecks ? Date.now() : null
  }, [performanceChecks])

  /** The performance-check fields every timed event of this path carries. */
  const nativeTelemetryBase = useCallback(
    () => ({
      camera_performance_checks: true,
      camera_backend: NATIVE_CAMERA_BACKEND,
      camera_variant: 'native',
      camera_platform: Platform.OS,
      camera_position: position,
      max_detail: maxDetail,
      motion_priority: motionPriority,
      low_light_boost_disabled: disableLowLightBoost,
      subject_metering: subjectMetering,
      requested_capture_tuning: requestedCaptureTuning.current ?? 'unreported',
    }),
    [
      disableLowLightBoost,
      maxDetail,
      motionPriority,
      position,
      subjectMetering,
    ],
  )

  const handleCameraReady = useCallback(
    (event?: { nativeEvent?: NativeCameraReadyEvent }) => {
      setIsCameraReady(true)
      requestedCaptureTuning.current =
        event?.nativeEvent?.requestedCaptureTuning ?? null
      const openedAt = cameraOpenedAt.current
      if (!performanceChecks || openedAt === null) return

      captureEvent(EVENTS.CAMERA_DEVICE_READY, {
        ...nativeTelemetryBase(),
        capture_backend: 'native',
        capture_mode: event?.nativeEvent?.captureMode ?? 'unreported',
        ...(event?.nativeEvent?.zslDisabledByConfig != null && {
          zsl_disabled_by_config: event.nativeEvent.zslDisabledByConfig,
        }),
        // Tells field-config sessions apart from tuning sessions.
        field_condition: event?.nativeEvent?.fieldCondition ?? 'none',
        output_format: event?.nativeEvent?.outputFormat ?? 'jpeg',
        ready_duration_ms: Date.now() - openedAt,
      })
    },
    [nativeTelemetryBase, performanceChecks],
  )

  /**
   * Forwards one native session diagnostic to PostHog. The native views do not
   * link an analytics SDK of their own, so this is the single consent gate and
   * the single distinct id for everything the camera session reports.
   */
  const handleCameraDiagnostic = useCallback(
    (event?: { nativeEvent?: NativeCameraDiagnosticEvent }) => {
      const payload = event?.nativeEvent
      if (!performanceChecks || !payload) return
      const { event: name, ...fields } = payload
      captureEvent(EVENTS.CAMERA_NATIVE_DIAGNOSTIC, {
        camera_performance_checks: true,
        capture_backend: 'native',
        camera_backend: NATIVE_CAMERA_BACKEND,
        camera_platform: Platform.OS,
        native_event: name,
        ...fields,
      })
    },
    [performanceChecks],
  )

  const handleTakePhoto = useCallback(async () => {
    const camera = cameraRef.current
    if (!canCapture || !isCameraReady || !camera) return
    const shutterTime = new Date().toISOString()
    const captureStartedAt = performanceChecks ? Date.now() : null

    const capture = async () => {
      const captured = await camera.capture({ flashMode })
      const capturedAt = performanceChecks ? Date.now() : null
      const processed = options.postprocessor
        ? await options.postprocessor.process(captured)
        : captured
      const processedAt = performanceChecks ? Date.now() : null

      const submission = persistCapturedPhoto(
        {
          ...processed,
          cameraConfig: nativeCameraConfig({
            platform: Platform.OS,
            position,
            flashMode,
            maxDetail,
            motionPriority,
            lowLightBoostDisabled: disableLowLightBoost,
            subjectMetering,
            captured,
          }),
        },
        shutterTime,
      )

      captureEvent(EVENTS.PHOTO_CAPTURED, {
        flash_mode: flashMode,
        photo_width: submission.width,
        photo_height: submission.height,
        capture_backend: 'native',
        ...(performanceChecks &&
        captureStartedAt !== null &&
        capturedAt !== null &&
        processedAt !== null
          ? {
              ...nativeTelemetryBase(),
              capture_mode: captured.captureMode ?? 'unreported',
              field_condition:
                captured.captureSettings?.field_condition ?? 'none',
              output_format: captured.captureSettings?.output_format ?? 'jpeg',
              delivered_format:
                captured.captureSettings?.delivered_format ??
                (captured.rawUri ? 'raw_jpeg' : 'jpeg'),
              capture_duration_ms: capturedAt - captureStartedAt,
              postprocess_duration_ms: processedAt - capturedAt,
              capture_pipeline_duration_ms: processedAt - captureStartedAt,
            }
          : {}),
      })

      startPhotoUpload()
    }

    await runCapture({
      capture,
      logTag: 'useNativeCameraCapture',
      failureProps: () => ({
        capture_backend: 'native',
        ...(performanceChecks && captureStartedAt !== null
          ? {
              ...nativeTelemetryBase(),
              elapsed_ms: Date.now() - captureStartedAt,
            }
          : {}),
      }),
    })
  }, [
    disableLowLightBoost,
    flashMode,
    isCameraReady,
    maxDetail,
    motionPriority,
    nativeTelemetryBase,
    options.postprocessor,
    performanceChecks,
    persistCapturedPhoto,
    position,
    runCapture,
    startPhotoUpload,
    subjectMetering,
    canCapture,
  ])

  const applySubjectRegion = useCallback(
    async (region: NormalizedSubjectRegion | null) => {
      if (!cameraRef.current || (!subjectMetering && region !== null))
        return false
      return cameraRef.current.setSubjectRegion(region)
    },
    [subjectMetering],
  )

  const focus = useCallback(async (point: { x: number; y: number }) => {
    if (!cameraRef.current) return false
    return cameraRef.current.focus(point)
  }, [])

  useEffect(() => {
    captureEvent(EVENTS.CAMERA_OPENED, { capture_backend: 'native' })
    if (__DEV__)
      console.log(
        '[location] consent hydrated:',
        useConsentStore.persist.hasHydrated(),
      )
  }, [])

  return {
    cameraRef,
    listRef,
    position,
    capturedPhotos,
    flashMode,
    isTakingPhoto,
    isCameraReady,
    setIsCameraReady,
    handleCameraReady,
    handleCameraDiagnostic,
    diagnostics: performanceChecks,
    isActive,
    canCapture,
    maxDetail,
    motionPriority,
    fieldCondition,
    disableLowLightBoost,
    subjectMetering,
    pinchZoom,
    flashOverlayStyle,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    focus,
    applySubjectRegion,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  }
}
