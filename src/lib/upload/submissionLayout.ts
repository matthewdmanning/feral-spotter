/**
 * lib/upload/submissionLayout.ts
 * The app's half of the Submission storage contract: where a Submission's
 * objects live and what they are called. functions/src/submissionLayout.ts
 * is the server's half and storage.rules enforces it; the rules-lane test
 * __tests__/rules/submissionLayout.contract.test.ts pins all three
 * together, so a change to one that the others miss fails a test.
 */

import { MAX_PHOTOS } from '@/src/config/submissionLimits'
import { extensionOf } from '@/src/utils/photoFormat'

export const METADATA_FILE_NAME = 'metadata.json'

/** A Submission's folder as a Storage reference path (no trailing slash). */
export function submissionFolder(uid: string, submissionId: string): string {
  return `submissions/${uid}/${submissionId}`
}

/** A Submission's folder as a name prefix, with its trailing slash. */
export function submissionPrefix(uid: string, submissionId: string): string {
  return `${submissionFolder(uid, submissionId)}/`
}

/** Object path of the photo in `slot` (0 … MAX_PHOTOS-1). */
export function photoObjectPath(
  uid: string,
  submissionId: string,
  slot: number,
  uri: string,
): string {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PHOTOS) {
    throw new Error(
      `[submissionLayout] slot ${slot} is outside 0…${MAX_PHOTOS - 1}`,
    )
  }
  const ext = extensionOf(uri) ?? 'jpg'
  return `${submissionPrefix(uid, submissionId)}photo-${slot}.${ext}`
}

export function metadataObjectPath(uid: string, submissionId: string): string {
  return `${submissionPrefix(uid, submissionId)}${METADATA_FILE_NAME}`
}
