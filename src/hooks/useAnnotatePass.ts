/**
 * hooks/useAnnotatePass.ts
 *
 * Screen-local state for the annotate screen's carousel: which photo is
 * showing, and per-photo removal. Cross-screen cat-discovery state
 * (which cat, per-photo located/pending) lives in useActiveCatFlow instead —
 * this hook is ephemeral and not persisted, unlike that one.
 *
 * Operates on the full photo pool (usePhotoStore), not a per-cat subset —
 * under the annotate-first flow no cat (and therefore no subset) exists yet
 * when a pass starts.
 */

import { useState, useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import type { ICarouselInstance } from 'react-native-reanimated-carousel'
import { usePhotoStore } from '@/src/hooks'
import { useActiveCatFlow } from '@/src/hooks/useActiveCatFlow'
import { useBoundingBoxStore } from '@/src/hooks/useBoundingBoxStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { EVENTS, captureEvent } from '@/src/lib/analytics/analytics'
import type { BoundingBox } from '@/src/types/BoundingBox'
import type { SubmissionPhoto } from '@/src/hooks/usePhotoStore'
import type { PhotoPassStatus } from '@/src/hooks/useActiveCatFlow'

type BoxInput = Omit<BoundingBox, 'id' | 'cat_id' | 'photo_local_id'>

export interface AnnotatePass {
  photos: SubmissionPhoto[]
  activeCatId: string | null
  getPhotoStatus: (photoId: string) => PhotoPassStatus
  currentIndex: number
  carouselRef: React.RefObject<ICarouselInstance | null>
  // Handlers
  handleConfirmBox: (box: BoxInput) => void
  handleNotInPhoto: () => void
  handleBoxingComplete: () => void
  clearActiveCat: () => void
  handleAbandonPass: () => void
  handlePrevPhoto: () => void
  handleLongPressRemove: () => void
  setCurrentIndex: (index: number) => void
}

export function useAnnotatePass(): AnnotatePass {
  const photos = usePhotoStore((s) => s.photos)
  const removePhoto = usePhotoStore((s) => s.removePhoto)
  const removeBoxesForPhoto = useBoundingBoxStore((s) => s.removeBoxesForPhoto)
  const settings = useSettingsStore((s) => s.settings)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const {
    activeCatId,
    getPhotoStatus,
    handleBoxConfirmed,
    handleNotInPhoto: markNotInPhoto,
    handleBoxingComplete: completeBoxing,
    clearActiveCat,
    handleAbandonPass,
  } = useActiveCatFlow()

  // TODO(Beta): add a popup confirming the user is done annotating before
  // leaving the pass (#282) — shared with the last-photo Confirm/Not-in-Photo
  // paths below, which currently reuse this handler directly.
  const handleBoxingComplete = useCallback(() => {
    captureEvent(EVENTS.CAT_BOXING_COMPLETED, {
      photo_count: photos.length,
    })
    completeBoxing()
  }, [photos.length, completeBoxing])

  // ── Carousel state ────────────────────────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(0)
  const carouselRef = useRef<ICarouselInstance>(null)

  // ── Clamp index during render when photo array shrinks ────────────────────
  const [prevPhotosLength, setPrevPhotosLength] = useState(photos.length)
  if (prevPhotosLength !== photos.length) {
    setPrevPhotosLength(photos.length)
    if (photos.length > 0 && currentIndex >= photos.length) {
      setCurrentIndex(photos.length - 1)
    }
  }

  // ── Confirm a box — persist via the flow hook, advance unless on the last
  //    photo (last photo ends the pass, same as Boxing Complete) ───────────
  // TODO(Beta): silently reusing handleBoxingComplete here gives no feedback
  // that the confirm landed before leaving (#282) — add a popup confirming
  // the user is done annotating. handleNotInPhoto below shares this gap.
  const handleConfirmBox = useCallback(
    (box: BoxInput) => {
      const photo = photos[currentIndex]
      if (!photo) return
      handleBoxConfirmed(photo.local_id, box)

      if (currentIndex < photos.length - 1) {
        const next = currentIndex + 1
        carouselRef.current?.scrollTo({ index: next, animated: true })
        setCurrentIndex(next)
      } else {
        handleBoxingComplete()
      }
    },
    [currentIndex, photos, handleBoxConfirmed, handleBoxingComplete],
  )

  // ── "Not in this photo" — record explicit absence, advance same as a
  //    confirmed box does (including last-photo -> Boxing Complete) ────────
  const handleNotInPhoto = useCallback(() => {
    const photo = photos[currentIndex]
    if (!photo) return
    markNotInPhoto(photo.local_id)

    if (currentIndex < photos.length - 1) {
      const next = currentIndex + 1
      carouselRef.current?.scrollTo({ index: next, animated: true })
      setCurrentIndex(next)
    } else {
      handleBoxingComplete()
    }
  }, [currentIndex, photos, markNotInPhoto, handleBoxingComplete])

  // ── Prev — go to previous photo ───────────────────────────────────────────
  const handlePrevPhoto = useCallback(() => {
    if (currentIndex === 0) return
    const prev = currentIndex - 1
    carouselRef.current?.scrollTo({ index: prev, animated: true })
    setCurrentIndex(prev)
  }, [currentIndex])

  // ── Long-press Remove ─────────────────────────────────────────────────────
  const handleLongPressRemove = useCallback(() => {
    const photo = photos[currentIndex]
    if (!photo) return

    const doRemove = () => {
      removePhoto(photo.local_id)
      removeBoxesForPhoto(photo.local_id)
    }

    if (settings.skip_photo_remove_confirm) {
      doRemove()
      return
    }

    Alert.alert('Remove photo from submission?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: "Remove, don't ask again",
        style: 'destructive',
        onPress: () => {
          updateSetting('skip_photo_remove_confirm', true)
          doRemove()
        },
      },
      { text: 'Remove', style: 'destructive', onPress: doRemove },
    ])
  }, [
    currentIndex,
    photos,
    settings.skip_photo_remove_confirm,
    removePhoto,
    removeBoxesForPhoto,
    updateSetting,
  ])

  return {
    photos,
    activeCatId,
    getPhotoStatus,
    currentIndex,
    setCurrentIndex,
    carouselRef,
    handleConfirmBox,
    handleNotInPhoto,
    handleBoxingComplete,
    clearActiveCat,
    handleAbandonPass,
    handlePrevPhoto,
    handleLongPressRemove,
  }
}
