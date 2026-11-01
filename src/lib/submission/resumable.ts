/**
 * lib/submission/resumable.ts
 * Whether Home offers "Continue Observation" for a draft.
 */

import { SUBMISSION_STALE_MS } from '@/src/shared/config/constants'
import type { SubmissionCacheFile } from '@/src/lib/cache/submissionCache'

/**
 * A draft can be resumed while it is unsent — In Progress, or Failed after a
 * send that did not land — and was touched within SUBMISSION_STALE_MS.
 * `latest` is the newest cache row, if any. A Failed row resumes only while
 * it is still the current draft (`currentId`): once its draft is cleared it
 * stays in history with nothing left to resume. An unreadable date does not
 * resume: start-up cleanup (draft.ts) discards that draft, so offering it
 * would offer something the next launch deletes.
 */
export function isResumableDraft(
  latest: Pick<SubmissionCacheFile, 'id' | 'status' | 'updated_at'> | undefined,
  now: number,
  currentId?: string | null,
): boolean {
  if (!latest) return false
  const unsent =
    latest.status === 'In Progress' ||
    (latest.status === 'Failed' && latest.id === currentId)
  if (!unsent) return false
  const age = now - new Date(latest.updated_at).getTime()
  return Number.isFinite(age) && age <= SUBMISSION_STALE_MS
}
