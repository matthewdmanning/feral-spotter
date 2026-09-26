/**
 * hooks/useCameraCapture.ts
 * Owns all camera business logic:
 *   - Photo capture + store writes + MediaLibrary save
 *   - Flash overlay animation (Reanimated SharedValue)
 *   - Flash mode cycling, camera flip
 *   - FlashList ref + scroll-to-end
 *   - Navigation (Done / Close)
 *
 * The screen retains only: permission gating, shutter press-feel animations,
 * and JSX layout.
 */

import { CameraThumb } from '@/src/components/atoms/CameraThumb'
import { usePhotoStore } from '@/src/hooks'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { useAuth } from '@/src/lib/auth/useAuth'
import { captureEvent, EVENTS } from '@/src/lib/analytics/analytics'
import { startLocationCapture } from '@/src/lib/location'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { gallerySavePermission } from '@/src/lib/permissions/gallerySavePermission'
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
import type { SubmissionPhoto } from '@/src/types'
import { type FlashListRef } from '@shopify/flash-list'
import { Asset } from 'expo-media-library'
import { router, useIsFocused } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  Platform,
  type AppStateStatus,
  type ViewStyle,
} from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {
  useCameraDevice,
  usePhotoOutput,
  type CameraPhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera'

// ─── Types ────────────────────────────────────────────────────────────────────

type FlashMode = 'off' | 'on' | 'auto'

export type CaptureMode = 'single' | 'burst'
export type { FlashMode }

export interface CameraCaptureResult {
  // Device
  device: ReturnType<typeof useCameraDevice>
  cameraRef: React.RefObject<CameraRef | null>
  photoOutput: CameraPhotoOutput
  isActive: boolean
  // State
  capturedPhotos: SubmissionPhoto[]
  flashMode: FlashMode
  isTakingPhoto: boolean
  captureMode: CaptureMode
  // Flash overlay (Reanimated — UI thread)
  flashOverlayStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>
  // FlashList
  listRef: React.RefObject<FlashListRef<SubmissionPhoto> | null>
  renderItem: (info: {
    item: SubmissionPhoto
    index: number
  }) => React.ReactElement
  keyExtractor: (item: SubmissionPhoto) => string
  // Handlers
  handleTakePhoto: () => Promise<void>
  setCaptureMode: (mode: CaptureMode) => void
  cycleFlash: () => void
  flipCamera: () => void
  handleDone: () => void
  handleClose: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCameraCapture(): CameraCaptureResult {
  const keepOnDevice = useSettingsStore(
    (s) => s.settings.keep_photos_on_device !== false,
  )
  const performanceChecks = useSettingsStore(
    (s) => s.settings.camera_performance_checks === true,
  )
  const addPhoto = usePhotoStore((s) => s.addPhoto)
  const removePhoto = usePhotoStore((s) => s.removePhoto)
  const updatePhoto = usePhotoStore((s) => s.updatePhoto)
  const { user } = useAuth()

  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back')
  const [capturedPhotos, setCapturedPhotos] = useState<SubmissionPhoto[]>([])
  const [flashMode, setFlashMode] = useState<FlashMode>('auto')
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('single')

  const device = useCameraDevice(cameraPosition)
  const cameraRef = useRef<CameraRef>(null)
  const listRef = useRef<FlashListRef<SubmissionPhoto>>(null)
  const qualityPrioritization =
    captureMode === 'burst'
      ? device?.supportsSpeedQualityPrioritization
        ? 'speed'
        : 'balanced'
      : undefined
  const photoOutput = usePhotoOutput(
    qualityPrioritization ? { qualityPrioritization } : undefined,
  )
  const burstStopRequested = useRef(false)

  // VisionCamera recommends preparing known photo settings ahead of capture on
  // iOS. This warms AVFoundation's capture path without introducing a parallel
  // native implementation; Android's equivalent is documented as a no-op.
  useEffect(() => {
    if (Platform.OS !== 'ios') return

    void photoOutput
      .prepareSettings([{ flashMode, enableShutterSound: true }])
      .catch((err) => {
        if (__DEV__) console.warn('[useCameraCapture] prepareSettings:', err)
      })
  }, [flashMode, photoOutput])

  // #253: Android reclaims the camera hardware whenever the app is
  // backgrounded for long enough (e.g. screen lock), regardless of this
  // prop. Without isActive tracking that, vision-camera never releases its
  // side of the session, and reconfiguring streams on resume against a
  // device the OS already reclaimed throws an uncaught native error.
  const isFocused = useIsFocused()
  const [appState, setAppState] = useState<AppStateStatus>('active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState)
    return () => sub.remove()
  }, [])
  const isActive = isFocused && appState === 'active'

  // ── Flash overlay — Reanimated SharedValue on UI thread ───────────────────
  const flashOpacity = useSharedValue(0)
  const flashOverlayStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: flashOpacity.value,
  }))

  // ── Capture ───────────────────────────────────────────────────────────────
  const handleTakePhoto = useCallback(async () => {
    // Burst is user-bounded rather than count-bounded: a tap starts it and
    // another tap requests a stop after the in-flight photo finishes.
    if (captureMode === 'burst' && isTakingPhoto) {
      burstStopRequested.current = true
      return
    }
    if (isTakingPhoto) return

    setIsTakingPhoto(true)
    burstStopRequested.current = false

    flashOpacity.value = withTiming(
      1,
      { duration: 25, easing: Easing.out(Easing.quad) },
      () => {
        flashOpacity.value = withTiming(0, { duration: 180 })
      },
    )

    const sequenceStartedAt = performanceChecks ? Date.now() : null
    let completedPhotoCount = 0

    try {
      // Permission cannot change meaningfully during one capture sequence.
      // Checking it once avoids repeated native bridge calls during bursts.
      const canSaveToGallery =
        keepOnDevice && (await gallerySavePermission.check())

      do {
        const captureStartedAt = performanceChecks ? Date.now() : null
        const photo = await photoOutput.capturePhoto(
          { flashMode, enableShutterSound: true },
          {},
        )
        const capturedAt = performanceChecks ? Date.now() : null

        let submission: SubmissionPhoto
        try {
          const filePath = await photo.saveToTemporaryFileAsync()
          const uri = `file://${filePath}`

          submission = {
            local_id: randomUUID(),
            uri,
            uploaded: false,
            upload_progress: 0,
            width: photo.width,
            height: photo.height,
            captured_at: new Date().toISOString(),
          }
        } finally {
          // Photo owns native camera buffers. Always release them, including
          // filesystem failures, or a long burst can accumulate native memory.
          photo.dispose()
        }

        const persistedAt = performanceChecks ? Date.now() : null
        completedPhotoCount += 1

        addPhoto(submission)
        setCapturedPhotos((prev) => [...prev, submission])
        captureEvent(EVENTS.PHOTO_CAPTURED, {
          flash_mode: flashMode,
          photo_width: submission.width,
          photo_height: submission.height,
          capture_mode: captureMode,
          quality_prioritization: qualityPrioritization ?? 'default',
          ...(performanceChecks &&
          captureStartedAt !== null &&
          capturedAt !== null &&
          persistedAt !== null
            ? {
                camera_performance_checks: true,
                camera_backend: 'visioncamera',
                camera_variant: `tap_${captureMode}`,
                camera_platform: Platform.OS,
                capture_duration_ms: capturedAt - captureStartedAt,
                temporary_file_save_duration_ms: persistedAt - capturedAt,
                capture_pipeline_duration_ms: persistedAt - captureStartedAt,
              }
            : {}),
        })

        const uid = user?.uid
        const submissionId = usePhotoStore.getState().submissionId
        if (uid && submissionId) {
          uploadNewPhoto(submission, uid, submissionId, updatePhoto)
        } else {
          console.error(
            '[useCameraCapture] missing uid/submissionId for upload',
          )
        }

        if (canSaveToGallery) {
          try {
            await Asset.create(submission.uri)
          } catch (err) {
            console.error('[useCameraCapture] Asset.create:', err)
          }
        }
      } while (captureMode === 'burst' && !burstStopRequested.current)

      if (captureMode === 'burst') {
        captureEvent(EVENTS.CAMERA_CAPTURE_SEQUENCE_COMPLETED, {
          capture_mode: captureMode,
          photo_count: completedPhotoCount,
          quality_prioritization: qualityPrioritization ?? 'default',
          ...(performanceChecks && sequenceStartedAt !== null
            ? {
                camera_performance_checks: true,
                camera_backend: 'visioncamera',
                camera_variant: 'tap_burst',
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
        ...(performanceChecks && sequenceStartedAt !== null
          ? {
              camera_performance_checks: true,
              camera_backend: 'visioncamera',
              camera_variant: `tap_${captureMode}`,
              camera_platform: Platform.OS,
              elapsed_ms: Date.now() - sequenceStartedAt,
            }
          : {}),
      })
    } finally {
      burstStopRequested.current = true
      setIsTakingPhoto(false)
    }
  }, [
    isTakingPhoto,
    captureMode,
    flashMode,
    flashOpacity,
    photoOutput,
    addPhoto,
    updatePhoto,
    keepOnDevice,
    user,
    qualityPrioritization,
    performanceChecks,
  ])

  useEffect(() => {
    if (!isActive) burstStopRequested.current = true
  }, [isActive])

  // ── Discard ───────────────────────────────────────────────────────────────
  const handleDiscardPhoto = useCallback(
    (localId: string) => {
      setCapturedPhotos((prev) => prev.filter((p) => p.local_id !== localId))
      removePhoto(localId)
    },
    [removePhoto],
  )

  // ── Controls ──────────────────────────────────────────────────────────────
  const cycleFlash = useCallback(() => {
    setFlashMode((m) => (m === 'auto' ? 'on' : m === 'on' ? 'off' : 'auto'))
  }, [])

  const flipCamera = useCallback(() => {
    setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))
  }, [])

  const handleDone = useCallback(
    () => router.navigate('/submission/create'),
    [],
  )
  const handleClose = useCallback(() => router.back(), [])

  // ── FlashList helpers ─────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: SubmissionPhoto; index: number }) => (
      <CameraThumb
        uri={item.uri}
        badgeCount={
          index === capturedPhotos.length - 1 ? capturedPhotos.length : 0
        }
        onRemove={() => handleDiscardPhoto(item.local_id)}
      />
    ),
    [capturedPhotos.length, handleDiscardPhoto],
  )

  const keyExtractor = useCallback((item: SubmissionPhoto) => item.local_id, [])

  useEffect(() => {
    if (capturedPhotos.length > 0) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [capturedPhotos.length])

  const cameraOpenedAt = useRef<number | null>(null)
  const hasReportedInitialDevice = useRef(false)

  // Record the start from an effect rather than render; Date.now() is impure
  // and React Compiler correctly rejects reading it during render.
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
            camera_variant: `tap_${captureMode}`,
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
    })
  }, [cameraPosition, captureMode, device, performanceChecks])

  // Funnel entry point — nothing else fires between opening the camera and
  // hitting submit besides this and PHOTO_CAPTURE_FAILED above.
  useEffect(() => {
    captureEvent(EVENTS.CAMERA_OPENED)
    // GPS-timing follow-up (#128): the Live fix starts here, not on
    // Submission Details — it runs in the background independent of this
    // screen's lifecycle (src/lib/location.ts).
    if (__DEV__)
      console.log(
        '[location] consent hydrated:',
        useConsentStore.persist.hasHydrated(),
      )
    void startLocationCapture()
  }, [])

  // #145/#146: request the gallery-save permission once, when the Camera
  // screen opens — not per shutter press (that re-triggered the OS prompt on
  // every press while status stayed non-terminal). writeOnly (true) requests
  // add-only access rather than the full READ_MEDIA_IMAGES grant, which is
  // what previously pulled in Android 14+'s "Select photos" picker UI (#140)
  // — this path only ever writes newly captured photos, never reads the
  // library, so it never needed read access in the first place.
  useEffect(() => {
    if (!keepOnDevice) return
    void gallerySavePermission.request()
  }, [keepOnDevice])

  return {
    device,
    cameraRef,
    photoOutput,
    isActive,
    capturedPhotos,
    flashMode,
    isTakingPhoto,
    captureMode,
    flashOverlayStyle,
    listRef,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    setCaptureMode,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  }
}
