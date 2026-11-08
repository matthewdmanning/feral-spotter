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
 * Maximum Submissions per uid (#270), enforced server-side through the
 * submissionCapReached claim. Documentation here; the contract test keeps
 * it equal to functions/.
 */
export const MAX_SUBMISSIONS_PER_UID = 250
