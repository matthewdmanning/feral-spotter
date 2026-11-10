/**
 * Account erasure (#433), as one ordered, idempotent pipeline over ports.
 * The deletion guard in the app decides `deleteSightings`; this decides
 * nothing else. Every step treats "already gone" as done, so a retry after
 * a partial failure finishes the job.
 *
 * Order matters: the Auth user goes last. Until then the account still
 * exists, so a failure leaves something the user can retry from, and the
 * Storage delete's own triggers (the Submission-cap recount) still find
 * their user.
 */

import type { EmailListProvider } from '../email/EmailListProvider'

export interface AnalyticsEraser {
  /** Delete the analytics person identified by `distinctId`, with its events. */
  erasePerson(distinctId: string): Promise<void>
}

export interface SubmissionStore {
  /** Delete every object under the uid's Submission folder. */
  deleteUserSubmissions(uid: string): Promise<void>
  /** Delete this owner's Firestore organization records. */
  deleteUserOrganizationPermissions(uid: string): Promise<void>
}

export interface AccountStore {
  /** Delete the Auth user. Resolves when the user is already gone. */
  deleteUser(uid: string): Promise<void>
}

export interface ErasurePorts {
  email: EmailListProvider
  analytics: AnalyticsEraser
  submissions: SubmissionStore
  accounts: AccountStore
}

export interface ErasureRequest {
  uid: string
  /** The account's one address, if it has one. */
  email?: string
  /** Chosen by the user at the deletion guard. Sightings stay otherwise. */
  deleteSightings: boolean
}

export async function eraseAccount(
  { uid, email, deleteSightings }: ErasureRequest,
  ports: ErasurePorts,
): Promise<void> {
  if (email) await ports.email.remove(email)
  await ports.analytics.erasePerson(uid)
  await ports.submissions.deleteUserOrganizationPermissions(uid)
  if (deleteSightings) await ports.submissions.deleteUserSubmissions(uid)
  await ports.accounts.deleteUser(uid)
}
