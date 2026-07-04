/**
 * hooks/useAnnotateStateMachine.ts
 *
 * State machine for the bounding-box annotation screen.
 *
 * Navigation model:
 *   Back — go to previous photo (no-op on first)
 *   Done — mark current as 'located', advance; on last photo → saveAndExit
 *
 * The dismiss-overlay animation has been removed; bounding-box drawing on the
 * Skia Canvas replaces the old long-press "locate" action.
 * handleLongPressRemove is retained for removing a photo from the submission.
 */

import { useState, useCallback, useRef, useMemo } from 'react'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import type { ICarouselInstance } from 'react-native-reanimated-carousel'
import { usePhotoStore, useSubmissionStore } from '@/src/hooks'
import { useAnnotationStore } from '@/src/hooks/useAnnotationStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import type { SubmissionPhoto } from '@/src/hooks/usePhotoStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PhotoStatus = 'pending' | 'located' | 'dismissed'

export interface AnnotateStateMachine {
  photos:       SubmissionPhoto[]
  statuses:     Record<string, PhotoStatus>
  currentIndex: number
  carouselRef:  React.RefObject<ICarouselInstance | null>
  // Handlers
  saveAndExit:           () => void
  handleDone:            () => void
  handleBack:            () => void
  handleLongPressRemove: () => void
  setCurrentIndex:       (index: number) => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnnotateStateMachine(cat_id: string): AnnotateStateMachine {
  const cat                 = useSubmissionStore((s) => s.cats.find((c) => c.local_id === cat_id))
  const updateCat           = useSubmissionStore((s) => s.updateCat)
  const allPhotos           = usePhotoStore((s) => s.photos)
  const removePhoto         = usePhotoStore((s) => s.removePhoto)
  const annotationSets      = useAnnotationStore((s) => s.annotationSets)
  const removeAnnotationSet = useAnnotationStore((s) => s.removeAnnotationSet)
  const settings            = useSettingsStore((s) => s.settings)
  const updateSetting       = useSettingsStore((s) => s.updateSetting)

  // ── Photo list ────────────────────────────────────────────────────────────
  const [photoIds, setPhotoIds] = useState<string[]>(() => cat?.photo_local_ids ?? [])

  const photos = useMemo(
    () =>
      photoIds
        .map((id) => allPhotos.find((p) => p.local_id === id))
        .filter((p): p is SubmissionPhoto => p !== undefined),
    [photoIds, allPhotos],
  )

  // ── Carousel state ────────────────────────────────────────────────────────
  const [statuses,     setStatuses]     = useState<Record<string, PhotoStatus>>(
    () => Object.fromEntries(photoIds.map((id) => [id, 'pending' as PhotoStatus])),
  )
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

  // ── Save & exit ───────────────────────────────────────────────────────────
  const saveAndExit = useCallback(() => {
    if (!cat_id) { router.back(); return }
    // Keep only non-dismissed photos; mark cat as reviewed
    const remaining = photoIds.filter((id) => statuses[id] !== 'dismissed')
    updateCat(cat_id, { photo_local_ids: remaining, photos_reviewed: true })
    router.back()
  }, [cat_id, photoIds, statuses, updateCat])

  // ── Done — mark located, advance or exit ──────────────────────────────────
  const handleDone = useCallback(() => {
    const photo = photos[currentIndex]
    if (!photo) return

    // Mark this photo as located for this cat
    setStatuses((prev) => ({ ...prev, [photo.local_id]: 'located' }))

    if (currentIndex < photos.length - 1) {
      const next = currentIndex + 1
      carouselRef.current?.scrollTo({ index: next, animated: true })
      setCurrentIndex(next)
    } else {
      // Last photo — save and return to cats screen
      const remaining = photoIds.filter(
        (id) => id === photo.local_id              // current (just located)
          || statuses[id] !== 'dismissed',         // previously not dismissed
      )
      updateCat(cat_id, { photo_local_ids: remaining, photos_reviewed: true })
      router.back()
    }
  }, [currentIndex, photos, photoIds, statuses, cat_id, updateCat])

  // ── Back — go to previous photo ───────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (currentIndex === 0) return
    const prev = currentIndex - 1
    carouselRef.current?.scrollTo({ index: prev, animated: true })
    setCurrentIndex(prev)
  }, [currentIndex])

  // ── Long-press Remove ─────────────────────────────────────────────────────
  const handleLongPressRemove = useCallback(() => {
    const photo = photos[currentIndex]
    if (!photo) return

    const hasOtherAnnotations = (annotationSets[photo.local_id]?.annotations ?? []).some(
      (a) => a.entity_id !== undefined && a.entity_id !== cat_id,
    )
    const canSkip = !hasOtherAnnotations && settings.skip_photo_remove_confirm

    const doRemove = () => {
      removePhoto(photo.local_id)
      removeAnnotationSet(photo.local_id)
      setPhotoIds((prev) => prev.filter((id) => id !== photo.local_id))
      setStatuses((prev) => {
        const next = { ...prev }
        delete next[photo.local_id]
        return next
      })
    }

    if (canSkip) { doRemove(); return }

    const warning = hasOtherAnnotations
      ? '\n\nThis photo has annotations for another cat — those will also be deleted.'
      : ''

    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doRemove },
    ]
    if (!hasOtherAnnotations) {
      buttons.splice(1, 0, {
        text:  "Remove, don't ask again",
        style: 'destructive',
        onPress: () => { updateSetting('skip_photo_remove_confirm', true); doRemove() },
      })
    }
    Alert.alert('Remove photo from submission?', `This cannot be undone.${warning}`, buttons)
  }, [
    currentIndex, photos, cat_id, annotationSets,
    settings.skip_photo_remove_confirm,
    removePhoto, removeAnnotationSet, updateSetting,
  ])

  return {
    photos, statuses, currentIndex, setCurrentIndex,
    carouselRef,
    saveAndExit, handleDone, handleBack, handleLongPressRemove,
  }
}
