/**
 * lib/submission/resumable.ts
 * Whether Home offers "Continue Observation" for a draft.
 */

import { SUBMISSION_STALE_MS } from '@/src/shared/config/constants'
import type { SubmissionCacheFile } from '@/src/features/draft-submission/lib/submissionCache'

/**
 * A draft can be resumed while it is still In Progress and was touched
 * within SUBMISSION_STALE_MS. `latest` is the newest cache row, if any.
 */
export function isResumableDraft(
  latest: Pick<SubmissionCacheFile, 'status' | 'updated_at'> | undefined,
  now: number,
): boolean {
  if (!latest || latest.status !== 'In Progress') return false
  // Written as "not stale" so an unreadable date (NaN) still resumes.
  const age = now - new Date(latest.updated_at).getTime()
  return !(age > SUBMISSION_STALE_MS)
}
