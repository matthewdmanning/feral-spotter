/**
 * hooks/useLibraryPhotoPicker.ts
 * "Choose from Library" entrypoint (#104): picks straight into the shared
 * photo pool, no staging/review screen — mirrors the camera's direct-add.
 * Location and time follow ADR 0002/0003: a Library-sourced draft forces
 * `location_type: 'pin'` (Map picker confirms it), and time comes from
 * EXIF `DateTime` when every picked photo has it, else falls back to manual.
 */

import { showAlert } from '@/src/shared/hooks/useUIStore'
import { isUploadablePhoto } from '@/src/utils/photoFormat'
import {
  usePhotoStore,
  isAtPhotoLimit,
  photoSlotsLeft,
  showPhotoLimitReached,
} from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/features/draft-submission/hooks/useSubmissionStore'
import { draftReadyOrAlert } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { EVENTS, captureEvent } from '@/src/shared/analytics/analytics'
import { libraryPermission } from '@/src/features/permissions/photo/lib/libraryPermission'
import { syncPhotoUploads } from '@/src/lib/upload/draftUploads'
import { buildSubmissionPhoto } from '@/src/features/draft-submission/lib/buildSubmissionPhoto'
import {
  classifyLibraryPickTime,
  parseExifDateTime,
} from '@/src/shared/utils/libraryPickTime'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useCallback } from 'react'
import { Linking, Platform } from 'react-native'

export interface LibraryPhotoPickerResult {
  pickFromLibrary: () => Promise<void>
}

export function useLibraryPhotoPicker(): LibraryPhotoPickerResult {
  const addPhotos = usePhotoStore((s) => s.addPhotos)
  const setLocationType = useSubmissionStore((s) => s.setLocationType)
  const setSubmission = useSubmissionStore((s) => s.setSubmission)

  const pickFromLibrary = useCallback(async () => {
    if (!(await draftReadyOrAlert())) return
    if (usePhotoStore.getState().source === 'camera') return
    if (isAtPhotoLimit()) {
      showPhotoLimitReached()
      return
    }
    // Check-then-request, mirroring useCameraCapture's write-only gallery-save
    // check (#145/#146): a granted/limited check short-circuits every repeat
    // tap, so the native request only ever fires once, on the first
    // undetermined pick.
    let usable = false
    try {
      usable = await libraryPermission.request()
    } catch (error) {
      console.error('[useLibraryPhotoPicker] permission', error)
    }
    if (!usable) {
      showAlert(
        'Photo library access needed',
        'Choose from Library needs access to your photos. Enable it in Settings, then try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      )
      return
    }

    let result: ImagePicker.ImagePickerResult
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        // Bypass the Android Photo Picker's empty Photos tab (#411). The
        // content chooser also exposes images outside its photo-library index.
        legacy: Platform.OS === 'android',
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        // Not honored by every picker (the legacy Android chooser ignores it),
        // so the result is trimmed below too.
        selectionLimit: photoSlotsLeft(),
        quality: 1,
        exif: true,
      })
    } catch (error) {
      console.error('[useLibraryPhotoPicker] picker', error)
      showAlert('Could not open your photos', 'Try again.')
      return
    }
    if (result.canceled || result.assets.length === 0) return

    // A camera capture may have arrived while the system picker was open.
    if (usePhotoStore.getState().source === 'camera') return
    const isFirstPick = usePhotoStore.getState().photos.length === 0
    // Only formats storage.rules accepts: anything else would be refused on
    // upload and sit un-uploaded, blocking Submit.
    const accepted = result.assets.filter(isUploadablePhoto)
    const skippedFormat = accepted.length < result.assets.length
    const slots = photoSlotsLeft()
    const kept = accepted.slice(0, slots)
    if (kept.length < accepted.length) showPhotoLimitReached()
    else if (skippedFormat) {
      showAlert(
        'Some photos were skipped',
        'Only JPEG, PNG and HEIC photos can be added.',
      )
    }
    if (kept.length === 0) return
    const newPhotos = kept.map(buildSubmissionPhoto)
    addPhotos(newPhotos)
    captureEvent(EVENTS.LIBRARY_PHOTOS_SELECTED, {
      photo_count: newPhotos.length,
      is_first_pick: isFirstPick,
    })

    syncPhotoUploads()

    // A draft is single-source by construction (ADR 0002 amendment): the
    // Home screen guard guarantees the pool was empty before this pick.
    if (isFirstPick) setLocationType('pin')

    // Classified over the whole pool, not this batch: "Select More Photos"
    // must not let a batch with EXIF time override a manual time the first
    // batch needed.
    const capturedAts = usePhotoStore
      .getState()
      .photos.map((photo) => parseExifDateTime(photo.exif?.timestamp))
    const { time_type, captured_at } = classifyLibraryPickTime(capturedAts)
    setSubmission({ time_type, captured_at })

    router.navigate('/submission/create')
  }, [addPhotos, setLocationType, setSubmission])

  return { pickFromLibrary }
}
