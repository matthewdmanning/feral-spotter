/**
 * workflows/photo-entry/hooks/useNoPhotosPrompt.ts
 * Cat List's prompt for a draft with no photos to annotate (#503). Annotate
 * never shows empty; Cat List asks instead, when:
 * - it opens with no photos, or
 * - it comes back into focus after the last photo went while it was
 *   covered (Annotate's remove ends the pass here), or
 * - "Add a Cat" / "Annotate Photos" finds nothing to annotate (`offer`).
 *
 * Choices: get more photos from the draft's own source, describe a cat
 * without boxes, then Back to Cat List when cats exist, else Cancel
 * Sighting. Photos emptied while Cat List is focused mean the draft was
 * torn down (submit, Reset), so that asks nothing. Just Describe marks the
 * draft done with photos: from then on only `offer` asks, until a new photo.
 */

import { confirmResetSubmission } from '@/src/features/draft-submission/hooks/confirmResetSubmission'
import { openCatForm } from '@/src/features/draft-submission/hooks/catPass'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { noPhotosCopy } from '@/src/shared/config/text'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { showAlert, type AlertButton } from '@/src/shared/hooks/useUIStore'
import { usePhotoEntrypoints } from '@/src/workflows/photo-entry/hooks/usePhotoEntrypoints'
import { useIsFocused } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'

export function useNoPhotosPrompt(): { offer: () => void } {
  const { camera, library } = usePhotoEntrypoints()
  const isFocused = useIsFocused()

  const offer = useCallback(() => {
    const { source, last_source } = usePhotoStore.getState()
    const getMore: AlertButton =
      (source ?? last_source) === 'library'
        ? { text: noPhotosCopy.uploadPhotos, onPress: library.open }
        : { text: noPhotosCopy.takePhotos, onPress: camera.open }
    const leave: AlertButton =
      useSubmissionStore.getState().cats.length > 0
        ? { text: noPhotosCopy.backToCatList, style: 'cancel' }
        : {
            text: noPhotosCopy.cancelSighting,
            style: 'destructive',
            onPress: confirmResetSubmission,
          }
    showAlert(noPhotosCopy.title, noPhotosCopy.message, [
      getMore,
      {
        text: noPhotosCopy.justDescribe,
        onPress: () => {
          usePhotoStore.getState().markDoneAddingPhotos()
          openCatForm()
        },
      },
      leave,
    ])
  }, [camera.open, library.open])

  // True when the next focused render should ask: opened with no photos,
  // or the last photo went while another screen covered this one. Never
  // once the user chose Just Describe.
  const shouldAsk = usePhotoStore(
    (s) => s.photos.length === 0 && !s.done_adding_photos,
  )
  const pending = useRef(shouldAsk)
  useEffect(() => {
    if (!shouldAsk) {
      pending.current = false
    } else if (!isFocused) {
      pending.current = true
    } else if (pending.current) {
      pending.current = false
      offer()
    }
  }, [shouldAsk, isFocused, offer])

  return { offer }
}
