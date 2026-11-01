/**
 * features/annotate/hooks/useAnnotationTutorial.ts
 * The annotation tutorial's show/skip/complete state and its analytics, for
 * the TutorialOverlay on the annotate screen. Shown on first annotation
 * entry only; a replay resets the status to 'unseen'.
 */

import { isTutorialReleased } from '@/src/features/annotate/config/tutorial'
import { useTutorialStore } from '@/src/features/annotate/hooks/useTutorialStore'
import { EVENTS, captureEvent } from '@/src/shared/analytics/analytics'
import { useState } from 'react'

export function useAnnotationTutorial() {
  const status = useTutorialStore((s) => s.annotation_tutorial_status)
  const setStatus = useTutorialStore((s) => s.setAnnotationTutorialStatus)
  const [startedAt, setStartedAt] = useState(0)

  return {
    open: isTutorialReleased() && status === 'unseen',
    onShow: () => {
      setStartedAt(Date.now())
      captureEvent(EVENTS.TUTORIAL_STARTED)
    },
    onStepCompleted: (step: number) =>
      captureEvent(EVENTS.TUTORIAL_STEP_COMPLETED, { step }),
    onSkip: (step: number) => {
      setStatus('skipped')
      captureEvent(EVENTS.TUTORIAL_SKIPPED, { step })
    },
    onComplete: () => {
      setStatus('completed')
      captureEvent(EVENTS.TUTORIAL_COMPLETED, {
        duration_ms: Date.now() - startedAt,
      })
    },
  }
}
