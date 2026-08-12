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
import { Alert, Linking } from 'react-native'

export interface LibraryPhotoPickerResult {
  pickFromLibrary: () => Promise<void>
}

// Yes means yes, not merely absence of no (#249, extending the camera/location
// pattern from #66/#237/#243): a decline inside launchImageLibraryAsync() and
// backing out of the picker without choosing anything both resolve as
// `{ canceled: true }` — indistinguishable unless permission is checked
// explicitly first. `limited` (iOS "Select Photos") counts as a valid yes.
function isLibraryPermissionUsable(
  response: ImagePicker.MediaLibraryPermissionResponse,
) {
  return (
    response.status === ImagePicker.PermissionStatus.GRANTED ||
    response.accessPrivileges === 'limited'
  )
}

export function useLibraryPhotoPicker(): LibraryPhotoPickerResult {
  const photos = usePhotoStore((s) => s.photos)
  const addPhotos = usePhotoStore((s) => s.addPhotos)
  const setLocationType = useSubmissionStore((s) => s.setLocationType)
  const setTimeType = useSubmissionStore((s) => s.setTimeType)
  const setCapturedAt = useSubmissionStore((s) => s.setCapturedAt)

  const pickFromLibrary = useCallback(async () => {
    // Check-then-request, mirroring useCameraCapture's write-only gallery-save
    // check (#145/#146): a granted/limited check short-circuits every repeat
    // tap, so request() only ever fires once, on the first undetermined pick.
    const current = await ImagePicker.getMediaLibraryPermissionsAsync()
    let usable = isLibraryPermissionUsable(current)
    if (!usable) {
      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync()
      usable = isLibraryPermissionUsable(requested)
    }
    if (!usable) {
      Alert.alert(
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
