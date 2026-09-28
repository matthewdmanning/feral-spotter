/**
 * Camera capture orchestration for the native identification camera.
 *
 * Owns only what is specific to the native view: the view ref, the ready flag,
 * the tuning props the view takes, subject metering, and this path's telemetry.
 * Everything around a capture comes from useCapturedPhotoWorkflow, so the
 * application workflow exists once rather than once per backend.
 */

import { useCapturedPhotoWorkflow } from '@/src/hooks/useCapturedPhotoWorkflow'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { captureEvent, EVENTS } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import type { ImagePostprocessor } from '@/src/lib/camera/pipeline'
import { startLocationCapture } from '@/src/lib/location'
import type {
  NativeIdentificationCameraRef,
  NormalizedSubjectRegion,
} from '@/modules/native-identification-camera'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

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
  const disableLowLightBoost = useSettingsStore(
    (s) => s.settings.camera_disable_low_light_boost === true,
  )
  const subjectMetering = useSettingsStore(
    (s) => s.settings.camera_subject_metering === true,
  )
  const performanceChecks = useSettingsStore(
    (s) => s.settings.camera_performance_checks === true,
  )

  const { user } = useAuth()

  const cameraRef = useRef<NativeIdentificationCameraRef>(null)
  const cameraOpenedAt = useRef<number | null>(null)
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)

  // Flipping rebinds the native session, so the ready flag has to drop and the
  // ready-duration measurement has to restart.
  const handleBeforeFlip = useCallback(() => {
    setIsCameraReady(false)
    cameraOpenedAt.current = performanceChecks ? Date.now() : null
  }, [performanceChecks])

  const {
    isActive,
    capturedPhotos,
    listRef,
    renderItem,
    keyExtractor,
    flashMode,
    cycleFlash,
    position,
    flipCamera,
    flashOverlayStyle,
    triggerFlash,
    persistCapturedPhoto,
    startPhotoUpload,
    flushGallerySaves,
    handleDone,
    handleClose,
  } = useCapturedPhotoWorkflow({ onBeforeFlip: handleBeforeFlip })

  // Mirrors isTakingPhoto so handleTakePhoto does not depend on state it sets
  // itself, which recreated the callback twice per capture.
  const isTakingPhotoRef = useRef(false)

  useEffect(() => {
    cameraOpenedAt.current = performanceChecks ? Date.now() : null
  }, [performanceChecks])

  const handleCameraReady = useCallback(() => {
    setIsCameraReady(true)
    const openedAt = cameraOpenedAt.current
    if (!performanceChecks || openedAt === null) return

    captureEvent(EVENTS.CAMERA_DEVICE_READY, {
      camera_performance_checks: true,
      capture_backend: 'native',
      camera_backend: Platform.OS === 'ios' ? 'avfoundation' : 'camerax',
      camera_variant: 'native',
      camera_platform: Platform.OS,
      camera_position: position,
      max_detail: maxDetail,
      motion_priority: motionPriority,
      low_light_boost_disabled: disableLowLightBoost,
      subject_metering: subjectMetering,
      ready_duration_ms: Date.now() - openedAt,
    })
  }, [
    disableLowLightBoost,
    maxDetail,
    motionPriority,
    performanceChecks,
    position,
    subjectMetering,
  ])

  const handleTakePhoto = useCallback(async () => {
    if (isTakingPhotoRef.current || !isCameraReady || !cameraRef.current) return
    isTakingPhotoRef.current = true
    setIsTakingPhoto(true)
    const shutterTime = new Date().toISOString()
    const captureStartedAt = performanceChecks ? Date.now() : null

    triggerFlash()

    try {
      const captured = await cameraRef.current.capture({ flashMode })
      const capturedAt = performanceChecks ? Date.now() : null
      const processed = options.postprocessor
        ? await options.postprocessor.process(captured)
        : captured
      const processedAt = performanceChecks ? Date.now() : null

      const submission = persistCapturedPhoto(processed, shutterTime)

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
              camera_performance_checks: true,
              camera_backend:
                Platform.OS === 'ios' ? 'avfoundation' : 'camerax',
              camera_variant: 'native',
              camera_platform: Platform.OS,
              camera_position: position,
              max_detail: maxDetail,
              motion_priority: motionPriority,
              low_light_boost_disabled: disableLowLightBoost,
              subject_metering: subjectMetering,
              capture_duration_ms: capturedAt - captureStartedAt,
              postprocess_duration_ms: processedAt - capturedAt,
              capture_pipeline_duration_ms: processedAt - captureStartedAt,
            }
          : {}),
      })

      startPhotoUpload(submission, user?.uid)
    } catch (error) {
      console.error('[useNativeCameraCapture] capture:', error)
      captureEvent(EVENTS.PHOTO_CAPTURE_FAILED, {
        error: error instanceof Error ? error.message : String(error),
        capture_backend: 'native',
        ...(performanceChecks && captureStartedAt !== null
          ? {
              camera_performance_checks: true,
              camera_backend:
                Platform.OS === 'ios' ? 'avfoundation' : 'camerax',
              camera_variant: 'native',
              camera_platform: Platform.OS,
              camera_position: position,
              max_detail: maxDetail,
              motion_priority: motionPriority,
              low_light_boost_disabled: disableLowLightBoost,
              subject_metering: subjectMetering,
              elapsed_ms: Date.now() - captureStartedAt,
            }
          : {}),
      })
    } finally {
      isTakingPhotoRef.current = false
      setIsTakingPhoto(false)
      void flushGallerySaves()
    }
  }, [
    disableLowLightBoost,
    flashMode,
    flushGallerySaves,
    isCameraReady,
    maxDetail,
    motionPriority,
    options.postprocessor,
    performanceChecks,
    persistCapturedPhoto,
    position,
    startPhotoUpload,
    subjectMetering,
    triggerFlash,
    user,
  ])

  const applySubjectRegion = useCallback(
    async (region: NormalizedSubjectRegion | null) => {
      if (!subjectMetering || !cameraRef.current) return false
      return cameraRef.current.setSubjectRegion(region)
    },
    [subjectMetering],
  )

  useEffect(() => {
    captureEvent(EVENTS.CAMERA_OPENED, { capture_backend: 'native' })
    if (__DEV__)
      console.log(
        '[location] consent hydrated:',
        useConsentStore.persist.hasHydrated(),
      )
    void startLocationCapture()
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
    isActive,
    maxDetail,
    motionPriority,
    disableLowLightBoost,
    subjectMetering,
    flashOverlayStyle,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    applySubjectRegion,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  }
}
