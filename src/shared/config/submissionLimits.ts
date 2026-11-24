/**
 * config/submissionLimits.ts
 * The Submission limits the app shares with storage.rules and functions/.
 * No imports, so the rules-lane contract test can load it in plain Node.
 * __tests__/rules/submissionLayout.contract.test.ts fails if these drift
 * from functions/src/submissionLayout.ts or from what storage.rules allows.
 */

/**
 * Maximum photos per Submission. storage.rules accepts only the names
 * photo-0 … photo-9, and usePhotoStore assigns each photo one of those
 * slots. Fixed, not env-overridable: rules cannot read app config.
 */
export const MAX_PHOTOS = 10

/**
 * Maximum Submissions per person, for life (#270, #486). A person is every
 * account with the same email. admitPhotoUpload enforces it; deleting
 * Submissions or the account refunds nothing. Documentation here; the
 * contract test keeps it equal to functions/.
 */
export const MAX_SUBMISSIONS_PER_UID = 250

/**
 * The Storage bucket Submissions upload to (ADR-0005). functions/' storage
 * triggers watch DEFAULT_BUCKET_NAME in functions/src/submissionLayout.ts;
 * the contract test keeps the two equal.
 */
export const STORAGE_BUCKET_NAME =
  'project-e3d5659d-bc4f-438f-88c.firebasestorage.app'
