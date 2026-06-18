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

import { useRef, useState, useCallback, useEffect } from 'react'
import { router } from 'expo-router'
import { Camera, useCameraDevice } from 'react-native-vision-camera'
import { FlashList } from '@shopify/flash-list'
import * as MediaLibrary from 'expo-media-library'
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { nanoid } from 'nanoid'
import { usePhotoStore, useUIStore } from '@/src/hooks'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import type { SubmissionPhoto } from '@/src/types'
import { CameraThumb, THUMB_TOTAL } from '@/src/components/atoms/CameraThumb'

// ─── Types ────────────────────────────────────────────────────────────────────

type FlashMode = 'off' | 'on' | 'auto'

export type { FlashMode }

export interface CameraCaptureResult {
  // Device
  device:           ReturnType<typeof useCameraDevice>
  cameraRef:        React.RefObject<Camera>
  // State
  capturedPhotos:   SubmissionPhoto[]
  flashMode:        FlashMode
  isTakingPhoto:    boolean
  // Flash overlay (Reanimated — UI thread)
  flashOverlayStyle: ReturnType<typeof useAnimatedStyle>
  // FlashList
  listRef:          React.RefObject<FlashList<SubmissionPhoto>>
  renderItem:       (info: { item: SubmissionPhoto; index: number }) => React.ReactElement
  keyExtractor:     (item: SubmissionPhoto) => string
  // Handlers
  handleTakePhoto:  () => Promise<void>
  cycleFlash:       () => void
  flipCamera:       () => void
  handleDone:       () => void
  handleClose:      () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCameraCapture(): CameraCaptureResult {
  const keepOnDevice     = useSettingsStore((s) => s.settings.keep_photos_on_device !== false)
  const addPhoto         = usePhotoStore((s) => s.addPhoto)
  const addSessionPhoto  = useUIStore((s) => s.addSessionPhoto)

  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back')
  const [capturedPhotos, setCapturedPhotos] = useState<SubmissionPhoto[]>([])
  const [flashMode,      setFlashMode]      = useState<FlashMode>('auto')
  const [isTakingPhoto,  setIsTakingPhoto]  = useState(false)

  const device    = useCameraDevice(cameraPosition)
  const cameraRef = useRef<Camera>(null)
  const listRef   = useRef<FlashList<SubmissionPhoto>>(null)

  // ── Flash overlay — Reanimated SharedValue on UI thread ───────────────────
  const flashOpacity     = useSharedValue(0)
  const flashOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }))

  // ── Capture ───────────────────────────────────────────────────────────────
  const handleTakePhoto = useCallback(async () => {
    if (!cameraRef.current || isTakingPhoto) return
    setIsTakingPhoto(true)

    flashOpacity.value = withTiming(1, { duration: 25, easing: Easing.out(Easing.quad) }, () => {
      flashOpacity.value = withTiming(0, { duration: 180 })
    })

    try {
      const photo = await cameraRef.current.takePhoto({
        flash:              flashMode,
        enableShutterSound: true,
      })
      const uri = `file://${photo.path}`

      const submission: SubmissionPhoto = {
        local_id:        nanoid(),
        uri,
        uploaded:        false,
        upload_progress: 0,
        width:           photo.width,
        height:          photo.height,
        exif: photo.metadata ? {
          latitude:  photo.metadata['GPS']?.Latitude,
          longitude: photo.metadata['GPS']?.Longitude,
          timestamp: photo.metadata['Exif']?.DateTimeOriginal,
        } : undefined,
      }

      addSessionPhoto(submission)
      addPhoto(submission)

      if (keepOnDevice) {
        const { status } = await MediaLibrary.requestPermissionsAsync()
        if (status === 'granted') await MediaLibrary.saveToLibraryAsync(uri)
      }

      setCapturedPhotos((prev) => [...prev, submission])
    } catch (err) {
      console.error('[useCameraCapture] takePhoto:', err)
    } finally {
      setIsTakingPhoto(false)
    }
  }, [isTakingPhoto, flashMode, flashOpacity, addPhoto, addSessionPhoto, keepOnDevice])

  // ── Controls ──────────────────────────────────────────────────────────────
  const cycleFlash  = useCallback(() => {
    setFlashMode((m) => m === 'auto' ? 'on' : m === 'on' ? 'off' : 'auto')
  }, [])

  const flipCamera  = useCallback(() => {
    setCameraPosition((p) => p === 'back' ? 'front' : 'back')
  }, [])

  const handleDone  = useCallback(() => router.navigate('/submission/create'), [])
  const handleClose = useCallback(() => router.navigate('/submission/create'), [])

  // ── FlashList helpers ─────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: SubmissionPhoto; index: number }) => (
      <CameraThumb
        uri={item.uri}
        badgeCount={index === capturedPhotos.length - 1 ? capturedPhotos.length : 0}
      />
    ),
    [capturedPhotos.length],
  )

  const keyExtractor = useCallback((item: SubmissionPhoto) => item.local_id, [])

  useEffect(() => {
    if (capturedPhotos.length > 0) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [capturedPhotos.length])

  return {
    device, cameraRef,
    capturedPhotos, flashMode, isTakingPhoto,
    flashOverlayStyle,
    listRef, renderItem, keyExtractor,
    handleTakePhoto, cycleFlash, flipCamera, handleDone, handleClose,
  }
}
