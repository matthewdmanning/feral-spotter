/**
 * hooks/confirmResetSubmission.ts
 * The one discard path for every screen, and its Reset confirmation (#153).
 */

import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/features/settings/hooks/useSettingsStore'
import { showAlert, showError } from '@/src/shared/hooks/useUIStore'
import {
  commonCopy,
  formatCopy,
  submissionCopy,
} from '@/src/shared/config/text'
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
      submissionCopy.exit.clearFailedTitle,
      submissionCopy.exit.clearFailedMessage,
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
  return keptInCameraRoll ? submissionCopy.exit.cameraRollNote : ''
}

function confirmDiscard(title: string, message: string, action: string): void {
  if (isDraftBusy()) return
  showAlert(title, formatCopy(message, { cameraRollNote: cameraRollNote() }), [
    { text: commonCopy.cancel, style: 'cancel' },
    { text: action, style: 'destructive', onPress: discardDraftAndGoHome },
  ])
}

/** Ask first, then discard the draft (#153). */
export function confirmResetSubmission(): void {
  confirmDiscard(
    submissionCopy.exit.resetTitle,
    submissionCopy.exit.resetMessage,
    submissionCopy.exit.resetAction,
  )
}

/**
 * Home's New Sighting: clear the current draft so a fresh one can start.
 * Home remounts empty, with Take Photos and Upload Photos enabled.
 */
export function confirmStartNewSighting(): void {
  confirmDiscard(
    submissionCopy.exit.newSightingTitle,
    submissionCopy.exit.newSightingMessage,
    submissionCopy.exit.newSightingAction,
  )
}
