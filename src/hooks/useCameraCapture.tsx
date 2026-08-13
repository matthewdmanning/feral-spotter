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
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
import type { SubmissionPhoto } from '@/src/types'
import { type FlashListRef } from '@shopify/flash-list'
import {
  Asset,
  getPermissionsAsync,
  PermissionStatus,
  requestPermissionsAsync,
} from 'expo-media-library'
import { router, useIsFocused } from 'expo-router'
import { randomUUID } from 'expo-crypto'
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
  usePhotoOutput,
  type CameraPhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera'

// ─── Types ────────────────────────────────────────────────────────────────────

type FlashMode = 'off' | 'on' | 'auto'

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
  const photoOutput = usePhotoOutput()

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
      }
      photo.dispose()

      addPhoto(submission)
      setCapturedPhotos((prev) => [...prev, submission])
      captureEvent(EVENTS.PHOTO_CAPTURED, {
        flash_mode: flashMode,
        photo_width: photo.width,
        photo_height: photo.height,
      })

      // Upload starts immediately, in the background — not gated on this
      // screen's lifecycle — so a slow/spotty connection doesn't block
      // capturing more photos.
      const uid = user?.uid
      const submissionId = usePhotoStore.getState().submissionId
      if (uid && submissionId) {
        uploadNewPhoto(submission, uid, submissionId, updatePhoto)
      } else {
        console.error('[useCameraCapture] missing uid/submissionId for upload')
      }

      // Location is set once per submission on the create screen (ADR 0002),
      // not per photo — no GPS call on the shutter path.

      if (keepOnDevice) {
        // #145/#146: check() only, never request() — see the mount effect
        // below for why. writeOnly (true) requests add-only access, which
        // matches app.json's savePhotosPermission config; unlike a full
        // read request, it has no Android 14+ "Select photos" partial-access
        // flow to surface (#140), since this path never reads the library.
        const { status } = await getPermissionsAsync(true)
        if (status === PermissionStatus.GRANTED) {
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

  // Funnel entry point — nothing else fires between opening the camera and
  // hitting submit besides this and PHOTO_CAPTURE_FAILED above.
  useEffect(() => {
    captureEvent(EVENTS.CAMERA_OPENED)
    // GPS-timing follow-up (#128): the Live fix starts here, not on
    // Submission Details — it runs in the background independent of this
    // screen's lifecycle (src/lib/location.ts).
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
    void (async () => {
      const { status } = await getPermissionsAsync(true)
      if (status !== PermissionStatus.GRANTED) {
        await requestPermissionsAsync(true)
      }
    })()
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
    cycleFlash,
    flipCamera,
    handleDone,
    handleClose,
  }
}
