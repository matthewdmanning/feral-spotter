import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { showAlert } from '@/src/hooks/useUIStore'
import { discardDraft } from '@/src/lib/submission/draft'
import { initializeDraft } from '@/src/hooks/useDraftStartupStore'
import { router } from 'expo-router'

/** Clear the whole draft and return Home. The one discard path for every screen. */
export async function discardDraftAndGoHome(): Promise<void> {
  await initializeDraft()
  await discardDraft()
  router.replace('/')
}

/**
 * Ask first, then discard the draft (#153). Reset never touches camera-roll
 * copies, so when "Keep Photos on Device" saved some, the dialog says they stay.
 */
export function confirmResetSubmission(): void {
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
