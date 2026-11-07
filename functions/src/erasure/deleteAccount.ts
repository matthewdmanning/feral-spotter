/**
 * The callable behind the app's deletion guard (#433). The caller is the
 * account being deleted: uid and email come from the verified token, never
 * from the request. Only `deleteSightings` comes from the request.
 */

import { HttpsError } from 'firebase-functions/v2/https'
import { eraseAccount, type ErasurePorts } from './eraseAccount'

/**
 * Deleting an account is security-sensitive: the token's sign-in must be
 * this recent, as Firebase requires of a client-side deleteUser. The app
 * re-authenticates the user first.
 */
export const RECENT_SIGN_IN_SECONDS = 5 * 60

export interface DeleteAccountRequest {
  auth?: {
    uid: string
    token: { email?: string; auth_time?: number }
  }
  data: unknown
}

export async function handleDeleteAccount(
  request: DeleteAccountRequest,
  ports: ErasurePorts,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<{ deleted: true }> {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to delete the account.')
  }
  const deleteSightings = (request.data as { deleteSightings?: unknown } | null)
    ?.deleteSightings
  if (typeof deleteSightings !== 'boolean') {
    throw new HttpsError(
      'invalid-argument',
      'deleteSightings must be a boolean.',
    )
  }
  const authTime = request.auth.token.auth_time ?? 0
  if (nowSeconds - authTime > RECENT_SIGN_IN_SECONDS) {
    throw new HttpsError('failed-precondition', 'requires-recent-login')
  }
  await eraseAccount(
    {
      uid: request.auth.uid,
      email: request.auth.token.email,
      deleteSightings,
    },
    ports,
  )
  return { deleted: true }
}
