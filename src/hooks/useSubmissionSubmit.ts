/**
 * hooks/useSubmissionSubmit.ts
 * Sighting Details' "Submit Sighting", "Reset" and "Discard" actions, as UI:
 * the confirm dialog, the user-facing messages and the navigation. The
 * lifecycle itself (lock, validation, upload wait, send, status moves,
 * teardown) is lib/submission/draft.ts's submitDraft()/discardDraft().
 *
 * The location/time accuracy warning icon stays informational, not a
 * submit gate (ADR-0002/0003). Zero cats and zero photos are hard blocks
 * (#265), reported by submitDraft as 'incomplete'.
 */

import { effectiveSharingSettings } from '@/src/types/Organizations'
import { useOrganizationsFlag } from '@/src/hooks/useOrganizationsFlag'
import { confirmedSharing } from '@/src/lib/organizations/consent'
import {
  persistOrganizationSharing,
  useOrganizationSharingStore,
} from '@/src/hooks/useOrganizationSharingStore'
import {
  confirmResetSubmission,
  discardDraftAndGoHome,
} from '@/src/hooks/confirmResetSubmission'
import { usePhotoStore } from '@/src/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/hooks/useSubmissionStore'
import { showAlert, showError } from '@/src/shared/hooks/useUIStore'
import {
  isDraftBusy,
  submitDraft,
  subscribeDraftBusy,
  type SubmitOutcome,
} from '@/src/lib/submission/draft'
import { router } from 'expo-router'
import { useCallback, useSyncExternalStore } from 'react'

export interface SubmissionSubmitResult {
  handleDone: () => void
  handleReset: () => void
  /** Clears the draft and returns Home with no confirmation of its own. */
  handleDiscard: () => Promise<void>
  isSubmitting: boolean
}

// #377: both failure paths leave every draft store intact, so both messages
// say so — a user who just lost 30 seconds has no other reason to believe it.
// They read differently because the next action differs: a stalled upload
// needs a better connection, a rejected send only needs a second attempt.
// The underlying error text goes to the console, never to the user.
const UPLOAD_STALLED_MESSAGE =
  'Your photos did not finish uploading. This sighting is saved on this device. Check your connection, then tap Submit Sighting to send it again.'
const SUBMIT_FAILED_MESSAGE =
  'The sighting did not reach the server. It is saved on this device. Tap Submit Sighting to send it again.'

/** True while a submit runs; the screen disables draft controls. */
export function useDraftBusy(): boolean {
  return useSyncExternalStore(subscribeDraftBusy, isDraftBusy, isDraftBusy)
}

function report(outcome: SubmitOutcome): void {
  switch (outcome.kind) {
    case 'sent':
      // Navigation stays here: its ordering against the create screen's
      // auto-skip effect is load-bearing (#189).
      router.replace('/')
      return
    case 'incomplete':
      showError('Sighting Incomplete', outcome.messages.join('\n'))
      return
    case 'sharing-unconfirmed':
      showError('Confirm organization sharing', outcome.message)
      return
    case 'uploads-unfinished':
      showError('Photos Still Uploading', UPLOAD_STALLED_MESSAGE)
      return
    case 'failed':
      showError('Sighting Failed', SUBMIT_FAILED_MESSAGE)
      return
    // 'busy' and 'superseded' need no message: another submit is running,
    // or the draft it started for is gone.
    default:
      return
  }
}

export function useSubmissionSubmit(): SubmissionSubmitResult {
  const catCount = useSubmissionStore((s) => s.cats.length)
  const photoCount = usePhotoStore((s) => s.photos.length)
  const isSubmitting = useDraftBusy()

  const handleDone = useCallback(() => {
    // One submit at a time; the confirm would be a second chance to tap.
    if (isDraftBusy()) return
    showAlert(
      'Submit Sighting',
      `Submit ${catCount} cat${catCount !== 1 ? 's' : ''} and ${photoCount} photo${photoCount !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: () => submitDraft().then(report),
        },
      ],
    )
  }, [catCount, photoCount])

  return {
    handleDone,
    handleReset: confirmResetSubmission,
    handleDiscard: discardDraftAndGoHome,
    isSubmitting,
  }
}
