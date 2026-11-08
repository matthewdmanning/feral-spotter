/**
 * hooks/confirmResetSubmission.ts
 * The one discard path for every screen, and its Reset confirmation (#153).
 */

import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { showAlert, showError } from '@/src/shared/hooks/useUIStore'
import {
  discardDraft,
  isDraftBusy,
} from '@/src/features/draft-submission/lib/draft'
import { initializeDraft } from '@/src/features/draft-submission/hooks/useDraftStartupStore'
import { router } from 'expo-router'

/**
 * Clear the whole draft and return Home. discardDraft() refuses while a
 * submit is running, and then nothing happens here either. Stays on the
 * screen with a message if storage fails, so the user is not told the
 * draft is gone when it is not.
 */
export async function discardDraftAndGoHome(): Promise<void> {
  try {
    await initializeDraft()
    if (!(await discardDraft())) return
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

/** Reset never touches camera-roll copies; say so when some were saved. */
function cameraRollNote(): string {
  const keptInCameraRoll =
    useSettingsStore.getState().settings.keep_photos_on_device !== false &&
    usePhotoStore.getState().source === 'camera'
  return keptInCameraRoll ? ' Copies saved to your camera roll stay there.' : ''
}

function confirmDiscard(title: string, message: string, action: string): void {
  if (isDraftBusy()) return
  showAlert(title, message + cameraRollNote(), [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: discardDraftAndGoHome },
  ])
}

/** Ask first, then discard the draft (#153). */
export function confirmResetSubmission(): void {
  confirmDiscard(
    'Reset Sighting',
    'This will permanently clear all cats, photos and sighting data.',
    'Reset',
  )
}

/**
 * Home's New Sighting: clear the current draft so a fresh one can start.
 * Home remounts empty, with Take Photos and Upload Photos enabled.
 */
export function confirmStartNewSighting(): void {
  confirmDiscard(
    'Start a New Sighting?',
    'This clears the cats, photos and details of your current sighting.',
    'Start New',
  )
}
