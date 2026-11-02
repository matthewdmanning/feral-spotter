/**
 * hooks/confirmResetSubmission.ts
 * The one discard path for every screen, and its Reset confirmation (#153).
 */

import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { showAlert, showError, useUIStore } from '@/src/hooks/useUIStore'
import { discardDraft } from '@/src/lib/submission/draft'
import { initializeDraft } from '@/src/hooks/useDraftStartupStore'
import { router } from 'expo-router'

/**
 * Clear the whole draft and return Home. Refused while a submit is running:
 * clearing the photo pool mid-send would send the cats with no photos.
 * Stays on the screen with a message if storage fails, so the user is not
 * told the draft is gone when it is not.
 */
export async function discardDraftAndGoHome(): Promise<void> {
  if (useUIStore.getState().isSubmitting) return
  try {
    await initializeDraft()
    await discardDraft()
  } catch (error) {
    console.error('[discardDraftAndGoHome]', error)
    showError(
      'Could Not Clear Draft',
      'Your draft could not be cleared. Restart the app and try again.',
    )
    return
  }
  router.replace('/')
}

/**
 * Ask first, then discard the draft (#153). Reset never touches camera-roll
 * copies, so when "Keep Photos on Device" saved some, the dialog says they stay.
 */
export function confirmResetSubmission(): void {
  if (useUIStore.getState().isSubmitting) return
  const keptInCameraRoll =
    useSettingsStore.getState().settings.keep_photos_on_device !== false &&
    usePhotoStore.getState().source === 'camera'
  showAlert(
    'Reset Submission',
    'This will permanently clear all cats, photos and submission data.' +
      (keptInCameraRoll ? ' Copies saved to your camera roll stay there.' : ''),
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: discardDraftAndGoHome,
      },
    ],
  )
}
