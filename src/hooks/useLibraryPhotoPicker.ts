/**
 * hooks/useLibraryPhotoPicker.ts
 * "Choose from Library" entrypoint (#104): picks straight into the shared
 * photo pool, no staging/review screen — mirrors the camera's direct-add.
 * Location and time follow ADR 0002/0003: a Library-sourced draft forces
 * `location_type: 'pin'` (Map picker confirms it), and time comes from
 * EXIF `DateTime` when every picked photo has it, else falls back to manual.
 */

import { usePhotoStore, useSubmissionStore } from '@/src/hooks'
import { EVENTS, captureEvent } from '@/src/lib/analytics/analytics'
import { buildSubmissionPhoto } from '@/src/utils/buildSubmissionPhoto'
import {
  classifyLibraryPickTime,
  parseExifDateTime,
} from '@/src/utils/libraryPickTime'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useCallback } from 'react'

export interface LibraryPhotoPickerResult {
  pickFromLibrary: () => Promise<void>
}

export function useLibraryPhotoPicker(): LibraryPhotoPickerResult {
  const photos = usePhotoStore((s) => s.photos)
  const addPhotos = usePhotoStore((s) => s.addPhotos)
  const setLocationType = useSubmissionStore((s) => s.setLocationType)
  const setTimeType = useSubmissionStore((s) => s.setTimeType)
  const setCapturedAt = useSubmissionStore((s) => s.setCapturedAt)

  const pickFromLibrary = useCallback(async () => {
    // Lazy, point-of-use permission prompt — no eager request() call.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
    })
    if (result.canceled || result.assets.length === 0) return

    const isFirstPick = photos.length === 0
    const newPhotos = result.assets.map(buildSubmissionPhoto)
    addPhotos(newPhotos)
    captureEvent(EVENTS.LIBRARY_PHOTOS_SELECTED, {
      photo_count: newPhotos.length,
      is_first_pick: isFirstPick,
    })

    // A draft is single-source by construction (ADR 0002 amendment): the
    // Home screen guard guarantees the pool was empty before this pick.
    if (isFirstPick) setLocationType('pin')

    const capturedAts = result.assets.map((asset) =>
      parseExifDateTime(asset.exif?.DateTime),
    )
    const { time_type, captured_at } = classifyLibraryPickTime(capturedAts)
    setTimeType(time_type)
    setCapturedAt(captured_at)

    router.navigate('/submission/create')
  }, [photos.length, addPhotos, setLocationType, setTimeType, setCapturedAt])

  return { pickFromLibrary }
}
