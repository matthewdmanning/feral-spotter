/**
 * Camera capture orchestration shared by the VisionCamera-backed camera paths.
 */

import { CameraThumb } from '@/src/components/atoms/CameraThumb'
import { usePhotoStore } from '@/src/hooks'
import { useIosIdentificationCapture } from '@/src/hooks/useIosIdentificationCapture'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { captureEvent, EVENTS } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import { startLocationCapture } from '@/src/lib/location'
import { gallerySavePermission } from '@/src/lib/permissions/gallerySavePermission'
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
import type { SubmissionPhoto } from '@/src/types'
import { buildSubmissionPhotoFromCapture } from '@/src/utils/buildSubmissionPhoto'
import { type FlashListRef } from '@shopify/flash-list'
import { Asset } from 'expo-media-library'
import { router, useIsFocused } from 'expo-router'
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
  const keepOnDevice = useSettingsStore(
    (s) => s.settings.keep_photos_on_device !== false,
  )
  const improvedCaptureSetting = useSettingsStore(
    (s) => s.settings.improved_camera_capture === true,
  )
  const performanceChecks = useSettingsStore(
    (s) => s.settings.camera_performance_checks === true,
  )
  const improvedCapture = Platform.OS === 'android' && improvedCaptureSetting

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

  const isFocused = useIsFocused()
  const [appState, setAppState] = useState<AppStateStatus>('active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState)
    return () => sub.remove()
  }, [])
  const isActive = isFocused && appState === 'active'

  const flashOpacity = useSharedValue(0)
  const flashOverlayStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: flashOpacity.value,
  }))

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
      const canSaveToGallery =
        keepOnDevice && (await gallerySavePermission.check())

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
          submission = buildSubmissionPhotoFromCapture(
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
        addPhoto(submission)
        setCapturedPhotos((prev) => [...prev, submission])

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
      setIsTakingPhoto(false)
    }
  }, [
    addPhoto,
    cameraVariant,
    captureMode,
    capturePipeline,
    effectiveQualityPrioritization,
    enableLowLightBoost,
    flashMode,
    flashOpacity,
    isTakingPhoto,
    keepOnDevice,
    performanceChecks,
    photoOutput,
    updatePhoto,
    user,
  ])

  useEffect(() => {
    if (!isActive) burstStopRequested.current = true
  }, [isActive])

  const handleDiscardPhoto = useCallback(
    (localId: string) => {
      setCapturedPhotos((prev) => prev.filter((p) => p.local_id !== localId))
      removePhoto(localId)
    },
    [removePhoto],
  )

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

  useEffect(() => {
    if (!keepOnDevice) return
    void gallerySavePermission.request()
  }, [keepOnDevice])

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
