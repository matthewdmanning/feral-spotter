/**
 * test-utils/photoFixtures.ts
 * One not-yet-uploaded submission photo for tests. A new required field
 * gets added here once.
 */

import type { SubmissionPhoto } from '@/src/shared/types'

export function submissionPhoto(
  patch: Partial<SubmissionPhoto> = {},
): SubmissionPhoto {
  const localId = patch.local_id ?? 'photo-1'
  return {
    local_id: localId,
    uri: `file:///${localId}.jpg`,
    uploaded: false,
    upload_progress: 0,
    width: 100,
    height: 100,
    ...patch,
  }
}
