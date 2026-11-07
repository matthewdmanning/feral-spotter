/**
 * The server's half of the Submission storage contract. The app's half is
 * src/lib/upload/submissionLayout.ts and storage.rules enforces it; the
 * rules-lane contract test pins all three together. Separate files because
 * functions/ is its own TypeScript project.
 */

export const METADATA_FILE_NAME = 'metadata.json'

/** Submissions per uid before storage.rules refuses a new metadata.json. */
export const MAX_SUBMISSIONS_PER_UID = 250

/** Auth custom claim storage.rules reads for the Submission cap. */
export const SUBMISSION_CAP_CLAIM = 'submissionCapReached'

const OBJECT_PATH = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)$/

export interface SubmissionObject {
  uid: string
  submissionId: string
  fileName: string
  isMetadata: boolean
}

/** Parses a Submission object path; null for anything else. */
export function parseSubmissionObject(name: string): SubmissionObject | null {
  const match = OBJECT_PATH.exec(name)
  if (!match) return null
  const [, uid, submissionId, fileName] = match
  return {
    uid,
    submissionId,
    fileName,
    isMetadata: fileName === METADATA_FILE_NAME,
  }
}

/** Every Submission object root, for listing. */
export const SUBMISSIONS_ROOT = 'submissions/'

/** One uid's folder, with its trailing slash (a bare prefix would match other uids). */
export function userPrefix(uid: string): string {
  return `${SUBMISSIONS_ROOT}${uid}/`
}

/** One Submission's folder, with its trailing slash. */
export function submissionPrefix(uid: string, submissionId: string): string {
  return `${userPrefix(uid)}${submissionId}/`
}
