/**
 * The server's half of the Submission storage contract. The app's half is
 * src/features/draft-submission/lib/upload/submissionLayout.ts and storage.rules enforces it; the
 * rules-lane contract test pins all three together. Separate files because
 * functions/ is its own TypeScript project.
 */

export const METADATA_FILE_NAME = 'metadata.json'

/**
 * Submissions per person, for life (#486): admitPhotoUpload refuses the
 * 251st metadata grant. storage.rules also checks a soft per-uid claim.
 */
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

/**
 * Use this function to recognize a photo name the app writes today: one
 * `photo-N.jpg` (any JPEG-family type, real type in contentType) and one
 * `photo-N.dng` per slot (#487).
 */
export function isSubmissionPhotoFileName(fileName: string): boolean {
  return /^photo-[0-9]\.(jpg|dng)$/.test(fileName)
}

/**
 * Use this function when reading stored objects: it also accepts names
 * written before #487 (`photo-N.jpeg|png|heic|heif`).
 */
export function isStoredPhotoFileName(fileName: string): boolean {
  return /^photo-[0-9]\.(jpg|jpeg|png|heic|heif|dng)$/.test(fileName)
}

/** Use this function to name a slot's JPEG-family object. */
export function photoFileName(slot: number): string {
  return `photo-${slot}.jpg`
}

/** Use this function to name a slot's paired DNG object. */
export function rawPhotoFileName(slot: number): string {
  return `photo-${slot}.dng`
}

/** Byte bounds storage.rules applies per object; a grant reserves these. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
export const MAX_RAW_PHOTO_BYTES = 64 * 1024 * 1024

// #486: hard per-uid upload quota. Every photo byte needs an upload grant,
// and the admission endpoint issues one only while the uid's stored objects
// plus open reservations stay within these bounds. See ADR-0005.
export const MAX_UPLOAD_BYTES_PER_UID = 20 * 1024 * 1024 * 1024
export const MAX_UPLOAD_OBJECTS_PER_UID = 5000

/** Auth custom claim storage.rules reads for upload grants. */
export const UPLOAD_GRANTS_CLAIM = 'uploadGrants'

/** How long a grant lets its objects be written. */
export const UPLOAD_GRANT_TTL_MS = 30 * 60 * 1000

/** Open grants per uid. Bounds the claim under Auth's 1000-byte limit. */
export const MAX_GRANTED_SUBMISSIONS = 3

/** storage.rules' metadata.json bound; a metadata grant reserves it. */
export const MAX_METADATA_BYTES = 256 * 1024

/**
 * Use this function to turn a file name into its grant token:
 * `photo-3.jpg` → `3.jpg`, `metadata.json` unchanged. storage.rules derives
 * the same token.
 */
export function grantToken(fileName: string): string {
  return fileName.replace(/^photo-/, '')
}

/** Use this function to invert grantToken. */
export function fileNameForToken(token: string): string {
  return token === METADATA_FILE_NAME ? token : `photo-${token}`
}

// Upload-limit state (#486), outside submissions/ and server-only. It
// survives account erasure: limits belong to the person, not the account.
export const UPLOAD_QUOTA_ROOT = 'upload-quota/'

/** One person's ledger. */
export function personLedgerPath(personId: string): string {
  return `${UPLOAD_QUOTA_ROOT}persons/${personId}/ledger.json`
}

/** Write-once pointer from a keyed email hash to its person. */
export function emailIndexPath(emailKey: string): string {
  return `${UPLOAD_QUOTA_ROOT}emails/${emailKey}.json`
}

/** Write-once pointer from a uid to its person; removed at erasure. */
export function uidIndexPath(uid: string): string {
  return `${UPLOAD_QUOTA_ROOT}uids/${uid}.json`
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
