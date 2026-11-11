/**
 * features/draft-submission/hooks/useSubmissionSubmit.ts
 * Sighting Details' "Submit Sighting", "Reset" and "Discard" actions, as UI:
 * the confirm dialog, the user-facing messages and the navigation. The
 * lifecycle itself (lock, validation, upload wait, send, status moves,
 * teardown) is features/draft-submission/lib/draft.ts's submitDraft()/discardDraft().
 *
 * The location/time accuracy warning icon stays informational, not a
 * submit gate (ADR-0002/0003). Zero cats and zero photos are hard blocks
 * (#265), reported by submitDraft as 'incomplete'.
 */

import {
  confirmResetSubmission,
  discardDraftAndGoHome,
} from '@/src/features/draft-submission/hooks/confirmResetSubmission'
import { usePhotoStore } from '@/src/features/draft-submission/hooks/usePhotoStore'
import { useSubmissionStore } from '@/src/shared/hooks/useSubmissionStore'
import { showAlert, showError } from '@/src/shared/hooks/useUIStore'
import { formatCopy, submissionCopy } from '@/src/shared/config/text'
import {
  isDraftBusy,
  submitDraft,
  subscribeDraftBusy,
  type SubmitOutcome,
} from '@/src/features/draft-submission/lib/draft'
import { router } from 'expo-router'
import { useCallback, useSyncExternalStore } from 'react'

export interface SubmissionSubmitResult {
  handleDone: () => void
  handleReset: () => void
  /** Clears the draft and returns Home with no confirmation of its own. */
  handleDiscard: () => Promise<void>
  isSubmitting: boolean
}

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
      showError(
        submissionCopy.alerts.incompleteTitle,
        outcome.messages.join('\n'),
      )
      return
    case 'sharing-unconfirmed':
      showError(submissionCopy.alerts.sharingUnconfirmedTitle, outcome.message)
      return
    case 'uploads-unfinished':
      showError(
        submissionCopy.alerts.uploadStalledTitle,
        submissionCopy.alerts.uploadStalled,
      )
      return
    case 'failed':
      showError(submissionCopy.alerts.failedTitle, submissionCopy.alerts.failed)
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
      submissionCopy.alerts.submitTitle,
      formatCopy(submissionCopy.alerts.confirm, {
        catCount,
        catLabel:
          catCount === 1
            ? submissionCopy.alerts.cat
            : submissionCopy.alerts.cats,
        photoCount,
        photoLabel:
          photoCount === 1
            ? submissionCopy.alerts.photo
            : submissionCopy.alerts.photos,
      }),
      [
        { text: submissionCopy.alerts.cancel, style: 'cancel' },
        {
          text: submissionCopy.alerts.submit,
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
