/**
 * lib/upload/uploadAdmission.ts
 * #486: storage.rules accepts photo bytes only under an upload grant, an
 * Auth custom claim that functions/' admitPhotoUpload sets after counting
 * the object against the uid's hard quota. This asks for the grant, then
 * refreshes the ID token so the Storage SDK sends it. See ADR-0005.
 */
import { getAuth } from '@react-native-firebase/auth'
import { UPLOAD_ADMISSION_URL } from '@/src/shared/config/constants'

/** A refused admission. `reason` is the server's, e.g. `quota_exceeded`. */
export class UploadAdmissionError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | undefined,
  ) {
    super(`[uploadAdmission] admission refused: ${status} ${reason ?? ''}`)
  }
}

// Grants this process already holds, keyed by submission, slot and kind.
// A re-upload of the same slot inside the grant skips the round trip.
const held = new Map<string, number>()
const EXPIRY_MARGIN_MS = 60 * 1000

/**
 * Use this function before writing a slot's bytes. `force` asks again even
 * when a grant is held: a token can lose a grant to an out-of-order claim
 * write, and the server then republishes the full set.
 */
export async function admitPhotoUpload(
  submissionId: string,
  slot: number,
  raw: boolean,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  const key = `${submissionId}/${slot}/${raw}`
  if (!force && (held.get(key) ?? 0) - EXPIRY_MARGIN_MS > Date.now()) return
  if (!UPLOAD_ADMISSION_URL) {
    throw new Error(
      '[uploadAdmission] EXPO_PUBLIC_UPLOAD_ADMISSION_URL is not set; storage.rules refuses photos without a grant',
    )
  }
  const user = getAuth().currentUser
  if (!user) throw new Error('NOT_SIGNED_IN')
  const response = await fetch(UPLOAD_ADMISSION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await user.getIdToken(false)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ submissionId, slot, raw }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new UploadAdmissionError(response.status, body?.error)
  }
  const { expiresAt } = (await response.json()) as { expiresAt: number }
  // The Storage SDK sends the cached token; only a fresh one has the grant.
  await user.getIdToken(true)
  held.set(key, expiresAt)
}

/** Test seam: forget held grants. */
export function resetHeldUploadGrants(): void {
  held.clear()
}
