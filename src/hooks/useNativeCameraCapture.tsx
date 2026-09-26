import { CameraThumb } from '@/src/components/atoms/CameraThumb'
import { usePhotoStore } from '@/src/hooks'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { captureEvent, EVENTS } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import type { ImagePostprocessor } from '@/src/lib/camera/pipeline'
import { startLocationCapture } from '@/src/lib/location'
import { gallerySavePermission } from '@/src/lib/permissions/gallerySavePermission'
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
import type { SubmissionPhoto } from '@/src/types'
import type {
  NativeCameraPosition,
  NativeFlashMode,
  NativeIdentificationCameraRef,
  NormalizedSubjectRegion,
} from '@/modules/native-identification-camera'
import { type FlashListRef } from '@shopify/flash-list'
import { randomUUID } from 'expo-crypto'
import { Asset } from 'expo-media-library'
import { router, useIsFocused } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus, type ViewStyle } from 'react-native'
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

interface NativeCameraCaptureOptions {
  postprocessor?: ImagePostprocessor
}

export function useNativeCameraCapture(
  options: NativeCameraCaptureOptions = {},
) {
  const keepOnDevice = useSettingsStore(
    (s) => s.settings.keep_photos_on_device !== false,
  )
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

  const addPhoto = usePhotoStore((s) => s.addPhoto)
  const removePhoto = usePhotoStore((s) => s.removePhoto)
  const updatePhoto = usePhotoStore((s) => s.updatePhoto)
  const { user } = useAuth()

  const cameraRef = useRef<NativeIdentificationCameraRef>(null)
  const listRef = useRef<FlashListRef<SubmissionPhoto>>(null)
  const [position, setPosition] = useState<NativeCameraPosition>('back')
  const [capturedPhotos, setCapturedPhotos] = useState<SubmissionPhoto[]>([])
  const [flashMode, setFlashMode] = useState<NativeFlashMode>('auto')
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)

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

  const handleTakePhoto = useCallback(async () => {
    if (isTakingPhoto || !isCameraReady || !cameraRef.current) return
    setIsTakingPhoto(true)
    const shutterTime = new Date().toISOString()

    flashOpacity.value = withTiming(
      1,
      { duration: 25, easing: Easing.out(Easing.quad) },
      () => {
        flashOpacity.value = withTiming(0, { duration: 180 })
      },
    )

    try {
      const captured = await cameraRef.current.capture({ flashMode })
      const processed = options.postprocessor
        ? await options.postprocessor.process(captured)
        : captured

      const submission: SubmissionPhoto = {
        local_id: randomUUID(),
        uri: processed.uri,
        uploaded: false,
        upload_progress: 0,
        width: processed.width,
        height: processed.height,
        captured_at: processed.capturedAt ?? captured.capturedAt ?? shutterTime,
      }

      addPhoto(submission)
      setCapturedPhotos((prev) => [...prev, submission])
      captureEvent(EVENTS.PHOTO_CAPTURED, {
        flash_mode: flashMode,
        photo_width: submission.width,
        photo_height: submission.height,
        capture_backend: 'native',
      })

      const uid = user?.uid
      const submissionId = usePhotoStore.getState().submissionId
      if (uid && submissionId) {
        uploadNewPhoto(submission, uid, submissionId, updatePhoto)
      } else {
        console.error('[useNativeCameraCapture] missing uid/submissionId')
      }

      if (keepOnDevice && (await gallerySavePermission.check())) {
        try {
          await Asset.create(submission.uri)
        } catch (error) {
          console.error('[useNativeCameraCapture] Asset.create:', error)
        }
      }
    } catch (error) {
      console.error('[useNativeCameraCapture] capture:', error)
      captureEvent(EVENTS.PHOTO_CAPTURE_FAILED, {
        error: error instanceof Error ? error.message : String(error),
        capture_backend: 'native',
      })
    } finally {
      setIsTakingPhoto(false)
    }
  }, [
    addPhoto,
    flashMode,
    flashOpacity,
    isCameraReady,
    isTakingPhoto,
    keepOnDevice,
    options.postprocessor,
    updatePhoto,
    user,
  ])

  const applySubjectRegion = useCallback(
    async (region: NormalizedSubjectRegion | null) => {
      if (!subjectMetering || !cameraRef.current) return false
      return cameraRef.current.setSubjectRegion(region)
    },
    [subjectMetering],
  )

  const handleDiscardPhoto = useCallback(
    (localId: string) => {
      setCapturedPhotos((prev) => prev.filter((p) => p.local_id !== localId))
      removePhoto(localId)
    },
    [removePhoto],
  )

  const cycleFlash = useCallback(() => {
    setFlashMode((mode) =>
      mode === 'auto' ? 'on' : mode === 'on' ? 'off' : 'auto',
    )
  }, [])

  const flipCamera = useCallback(() => {
    setIsCameraReady(false)
    setPosition((current) => (current === 'back' ? 'front' : 'back'))
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

  useEffect(() => {
    captureEvent(EVENTS.CAMERA_OPENED, { capture_backend: 'native' })
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
    cameraRef,
    listRef,
    position,
    capturedPhotos,
    flashMode,
    isTakingPhoto,
    isCameraReady,
    setIsCameraReady,
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
