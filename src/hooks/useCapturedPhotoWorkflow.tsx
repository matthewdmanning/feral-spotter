/**
 * The application workflow around a capture, shared by both capture backends.
 *
 * Per the camera seam contract, the native view owns the camera session and
 * this layer owns the application workflow: screen chrome state, captured
 * photo state, the upload and gallery-save flow, and navigation. Neither
 * capture hook should hold its own copy of any of it — the copies had already
 * drifted, which is how the duplicate device-ready telemetry got in.
 *
 * Analytics is deliberately NOT here. The two paths still emit different event
 * property sets, and unifying that vocabulary is separate work; each hook
 * keeps its own captureEvent calls until then.
 */

import { CameraThumb } from '@/src/components/atoms/CameraThumb'
import { usePhotoStore } from '@/src/hooks'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { gallerySavePermission } from '@/src/lib/permissions/gallerySavePermission'
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
import type { SubmissionPhoto } from '@/src/types'
import {
  buildSubmissionPhotoFromCapture,
  type CapturedFrame,
} from '@/src/utils/buildSubmissionPhoto'
import { type FlashListRef } from '@shopify/flash-list'
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

export type FlashMode = 'off' | 'on' | 'auto'
export type CameraPosition = 'back' | 'front'

interface CapturedPhotoWorkflowOptions {
  /**
   * Called before the camera position changes. The native path uses it to drop
   * its ready flag, because flipping rebinds the session.
   */
  onBeforeFlip?: () => void
}

export function useCapturedPhotoWorkflow({
  onBeforeFlip,
}: CapturedPhotoWorkflowOptions = {}) {
  const keepOnDevice = useSettingsStore(
    (s) => s.settings.keep_photos_on_device !== false,
  )

  const addPhoto = usePhotoStore((s) => s.addPhoto)
  const removePhoto = usePhotoStore((s) => s.removePhoto)
  const updatePhoto = usePhotoStore((s) => s.updatePhoto)

  const [capturedPhotos, setCapturedPhotos] = useState<SubmissionPhoto[]>([])
  const [flashMode, setFlashMode] = useState<FlashMode>('auto')
  const [position, setPosition] = useState<CameraPosition>('back')
  const listRef = useRef<FlashListRef<SubmissionPhoto>>(null)

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

  const triggerFlash = useCallback(() => {
    flashOpacity.value = withTiming(
      1,
      { duration: 25, easing: Easing.out(Easing.quad) },
      () => {
        flashOpacity.value = withTiming(0, { duration: 180 })
      },
    )
  }, [flashOpacity])

  // Gallery writes are collected rather than performed per frame. Awaiting
  // MediaLibrary inside a burst loop bounded the burst rate by gallery I/O
  // instead of by the camera.
  const pendingGallerySaves = useRef<string[]>([])

  /**
   * Turns a capture into a stored, uploading SubmissionPhoto. Throws if the
   * capture reported no usable dimensions or a non-local uri, so the caller's
   * failure telemetry sees it.
   */
  const persistCapturedPhoto = useCallback(
    (frame: CapturedFrame, shutterTime: string): SubmissionPhoto => {
      const submission = buildSubmissionPhotoFromCapture(frame, shutterTime)

      addPhoto(submission)
      setCapturedPhotos((prev) => [...prev, submission])

      if (keepOnDevice) pendingGallerySaves.current.push(submission.uri)

      return submission
    },
    [addPhoto, keepOnDevice],
  )

  /**
   * Starts the background upload for a photo persistCapturedPhoto returned.
   * Kept separate so the caller supplies the authenticated user without this
   * hook reaching for auth state it does not otherwise need.
   */
  const startPhotoUpload = useCallback(
    (submission: SubmissionPhoto, uid: string | undefined) => {
      const { submissionId } = usePhotoStore.getState()
      if (!uid || !submissionId) {
        console.error(
          '[useCapturedPhotoWorkflow] missing uid/submissionId for upload',
        )
        return
      }
      uploadNewPhoto(submission, uid, submissionId, updatePhoto)
    },
    [updatePhoto],
  )

  /**
   * Writes every collected capture to the gallery. Called once after a capture
   * sequence finishes, not once per frame.
   */
  const flushGallerySaves = useCallback(async () => {
    const uris = pendingGallerySaves.current
    pendingGallerySaves.current = []
    if (uris.length === 0) return
    if (!(await gallerySavePermission.check())) return

    for (const uri of uris) {
      try {
        await Asset.create(uri)
      } catch (error) {
        console.error('[useCapturedPhotoWorkflow] Asset.create:', error)
      }
    }
  }, [])

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
    onBeforeFlip?.()
    setPosition((p) => (p === 'back' ? 'front' : 'back'))
  }, [onBeforeFlip])

  const handleDone = useCallback(
    () => router.navigate('/submission/create'),
    [],
  )
  const handleClose = useCallback(() => router.back(), [])

  // The thumbnail count is read through a ref so renderItem stays stable. It
  // used to depend on capturedPhotos.length, which recreated the callback on
  // every captured frame and re-rendered the whole list mid-burst.
  const photoCount = useRef(0)
  useEffect(() => {
    photoCount.current = capturedPhotos.length
  }, [capturedPhotos.length])

  const renderItem = useCallback(
    ({ item, index }: { item: SubmissionPhoto; index: number }) => (
      <CameraThumb
        uri={item.uri}
        badgeCount={index === photoCount.current - 1 ? photoCount.current : 0}
        onRemove={() => handleDiscardPhoto(item.local_id)}
      />
    ),
    [handleDiscardPhoto],
  )

  const keyExtractor = useCallback((item: SubmissionPhoto) => item.local_id, [])

  // ponytail: one animated scroll per captured frame, so a burst still lands a
  // scroll between captures. Drop the animation while a sequence is running if
  // on-device profiling shows it costing frames.
  useEffect(() => {
    if (capturedPhotos.length > 0) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [capturedPhotos.length])

  useEffect(() => {
    if (!keepOnDevice) return
    void gallerySavePermission.request()
  }, [keepOnDevice])

  return {
    keepOnDevice,
    isActive,
    capturedPhotos,
    listRef,
    renderItem,
    keyExtractor,
    handleDiscardPhoto,
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
  }
}
