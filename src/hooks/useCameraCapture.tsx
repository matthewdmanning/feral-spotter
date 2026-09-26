/**
 * hooks/useCameraCapture.ts
 * Owns all camera business logic:
 *   - Photo capture + store writes + MediaLibrary save
 *   - Flash overlay animation (Reanimated SharedValue)
 *   - Flash mode cycling, camera flip
 *   - FlashList ref + scroll-to-end
 *   - Navigation (Done / Close)
 */

import { CameraThumb } from '@/src/components/atoms/CameraThumb'
import { usePhotoStore } from '@/src/hooks'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { useIosIdentificationCapture } from '@/src/hooks/useIosIdentificationCapture'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { captureEvent, EVENTS } from '@/src/lib/analytics/analytics'
import { useAuth } from '@/src/lib/auth/useAuth'
import { startLocationCapture } from '@/src/lib/location'
import { gallerySavePermission } from '@/src/lib/permissions/gallerySavePermission'
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
import type { SubmissionPhoto } from '@/src/types'
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
import {
  useCameraDevice,
  type CameraPhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera'

type FlashMode = 'off' | 'on' | 'auto'

export type { FlashMode }

export interface CameraCaptureResult {
  device: ReturnType<typeof useCameraDevice>
  cameraRef: React.RefObject<CameraRef | null>
  photoOutput: CameraPhotoOutput
  isActive: boolean
  capturedPhotos: SubmissionPhoto[]
  flashMode: FlashMode
  isTakingPhoto: boolean
  flashOverlayStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>
  listRef: React.RefObject<FlashListRef<SubmissionPhoto> | null>
  renderItem: (info: {
    item: SubmissionPhoto
    index: number
  }) => React.ReactElement
  keyExtractor: (item: SubmissionPhoto) => string
  handleTakePhoto: () => Promise<void>
  handleCameraConfigured: () => void
  cycleFlash: () => void
  flipCamera: () => void
  handleDone: () => void
  handleClose: () => void
}

export function useCameraCapture(): CameraCaptureResult {
  const keepOnDevice = useSettingsStore(
    (s) => s.settings.keep_photos_on_device !== false,
  )
  const addPhoto = usePhotoStore((s) => s.addPhoto)
  const removePhoto = usePhotoStore((s) => s.removePhoto)
  const updatePhoto = usePhotoStore((s) => s.updatePhoto)
  const { user } = useAuth()

  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back')
  const [capturedPhotos, setCapturedPhotos] = useState<SubmissionPhoto[]>([])
  const [flashMode, setFlashMode] = useState<FlashMode>('auto')
  const [isTakingPhoto, setIsTakingPhoto] = useState(false)

  const device = useCameraDevice(cameraPosition)
  const cameraRef = useRef<CameraRef>(null)
  const listRef = useRef<FlashListRef<SubmissionPhoto>>(null)
  const { photoOutput, handleCameraConfigured } = useIosIdentificationCapture(
    device,
    flashMode,
  )

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
    if (isTakingPhoto) return
    setIsTakingPhoto(true)

    flashOpacity.value = withTiming(
      1,
      { duration: 25, easing: Easing.out(Easing.quad) },
      () => {
        flashOpacity.value = withTiming(0, { duration: 180 })
      },
    )

    try {
      const photo = await photoOutput.capturePhoto(
        { flashMode, enableShutterSound: true },
        {},
      )
      const filePath = await photo.saveToTemporaryFileAsync()
      const uri = `file://${filePath}`

      const submission: SubmissionPhoto = {
        local_id: randomUUID(),
        uri,
        uploaded: false,
        upload_progress: 0,
        width: photo.width,
        height: photo.height,
        captured_at: new Date().toISOString(),
      }
      photo.dispose()

      addPhoto(submission)
      setCapturedPhotos((prev) => [...prev, submission])
      captureEvent(EVENTS.PHOTO_CAPTURED, {
        flash_mode: flashMode,
        photo_width: submission.width,
        photo_height: submission.height,
      })

      const uid = user?.uid
      const submissionId = usePhotoStore.getState().submissionId
      if (uid && submissionId) {
        uploadNewPhoto(submission, uid, submissionId, updatePhoto)
      } else {
        console.error('[useCameraCapture] missing uid/submissionId for upload')
      }

      if (keepOnDevice) {
        if (await gallerySavePermission.check()) {
          try {
            await Asset.create(uri)
          } catch (err) {
            console.error('[useCameraCapture] Asset.create:', err)
          }
        }
      }
    } catch (err) {
      console.error('[useCameraCapture] takePhoto:', err)
      captureEvent(EVENTS.PHOTO_CAPTURE_FAILED, {
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsTakingPhoto(false)
    }
  }, [
    isTakingPhoto,
    flashMode,
    flashOpacity,
    photoOutput,
    addPhoto,
    updatePhoto,
    keepOnDevice,
    user,
  ])

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
    capturedPhotos,
    flashMode,
    isTakingPhoto,
    flashOverlayStyle,
    listRef,
    renderItem,
    keyExtractor,
    handleTakePhoto,
    handleCameraConfigured,
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  }
}
