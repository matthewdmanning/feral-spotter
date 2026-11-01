/**
 * hooks/useLibraryPhotoPicker.ts
 * "Choose from Library" entrypoint (#104): picks straight into the shared
 * photo pool, no staging/review screen — mirrors the camera's direct-add.
 * Location and time follow ADR 0002/0003: a Library-sourced draft forces
 * `location_type: 'pin'` (Map picker confirms it), and time comes from
 * EXIF `DateTime` when every picked photo has it, else falls back to manual.
 */

import { showAlert } from '@/src/shared/hooks/useUIStore'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import { initializeDraft } from '@/src/hooks/useDraftStartupStore'
import { EVENTS, captureEvent } from '@/src/shared/analytics/analytics'
import { libraryPermission } from '@/src/features/permissions/photo/lib/libraryPermission'
import { uploadNewPhoto } from '@/src/lib/upload/uploadNewPhoto'
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
  const updatePhoto = usePhotoStore((s) => s.updatePhoto)
  const setLocationType = useSubmissionStore((s) => s.setLocationType)
  const setSubmission = useSubmissionStore((s) => s.setSubmission)
  const { user } = useAuth()

  const pickFromLibrary = useCallback(async () => {
    try {
      await initializeDraft()
    } catch {
      showAlert(
        'Could not restore your sighting',
        'Restart the app to try again.',
      )
      return
    }
    if (usePhotoStore.getState().source === 'camera') return
    // Check-then-request, mirroring useCameraCapture's write-only gallery-save
    // check (#145/#146): a granted/limited check short-circuits every repeat
    // tap, so the native request only ever fires once, on the first
    // undetermined pick.
    const usable = await libraryPermission.request()
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

    const result = await ImagePicker.launchImageLibraryAsync({
      // Bypass the Android Photo Picker's empty Photos tab (#411). The
      // content chooser also exposes images outside its photo-library index.
      legacy: Platform.OS === 'android',
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      exif: true,
    })
    if (result.canceled || result.assets.length === 0) return

    // A camera capture may have arrived while the system picker was open.
    if (usePhotoStore.getState().source === 'camera') return
    const isFirstPick = usePhotoStore.getState().photos.length === 0
    const newPhotos = result.assets.map(buildSubmissionPhoto)
    addPhotos(newPhotos)
    captureEvent(EVENTS.LIBRARY_PHOTOS_SELECTED, {
      photo_count: newPhotos.length,
      is_first_pick: isFirstPick,
    })

    const uid = user?.uid
    const submissionId = usePhotoStore.getState().submissionId
    if (uid && submissionId) {
      for (const photo of newPhotos) {
        uploadNewPhoto(photo, uid, submissionId, updatePhoto)
      }
    } else {
      console.error(
        '[useLibraryPhotoPicker] missing uid/submissionId for upload',
      )
    }

    // A draft is single-source by construction (ADR 0002 amendment): the
    // Home screen guard guarantees the pool was empty before this pick.
    if (isFirstPick) setLocationType('pin')

    const capturedAts = result.assets.map((asset) =>
      parseExifDateTime(asset.exif?.DateTime),
    )
    const { time_type, captured_at } = classifyLibraryPickTime(capturedAts)
    setSubmission({ time_type, captured_at })

    router.navigate('/submission/create')
  }, [addPhotos, updatePhoto, setLocationType, setSubmission, user])

  return { pickFromLibrary }
}
