/**
 * #486: hard per-uid upload quota, without a database.
 *
 * Storage rules cannot count objects or bytes, so a client may write a photo
 * only under an upload grant: the Auth custom claim `uploadGrants`, which
 * storage.rules checks. This endpoint is the only issuer. It admits a grant
 * only while the uid's stored objects plus every open reservation stay
 * within the quota, and it serializes admissions per uid through a ledger
 * object written with a generation precondition.
 *
 * The ledger is authoritative. A claim is always a copy of some ledger
 * version, and the ledger never drops a grant before its reservation ends,
 * so every grant a token can carry is counted. A lost or stale claim write
 * only refuses an upload; the client asks again. See ADR-0005.
 */
import { validId } from '../organizations/domain'
import {
  MAX_GRANTED_SUBMISSIONS,
  MAX_METADATA_BYTES,
  MAX_PHOTO_BYTES,
  MAX_RAW_PHOTO_BYTES,
  MAX_UPLOAD_BYTES_PER_UID,
  MAX_UPLOAD_OBJECTS_PER_UID,
  METADATA_FILE_NAME,
  UPLOAD_GRANT_TTL_MS,
  fileNameForToken,
  grantToken,
  photoFileName,
  rawPhotoFileName,
  submissionPrefix,
} from '../submissionLayout'

/** Grant tokens (`3.jpg`, `3.dng`, `metadata.json`) for one Submission, writable until `e` (epoch ms). */
export interface SubmissionGrant {
  e: number
  f: string[]
}
export type UploadGrants = Record<string, SubmissionGrant>
export interface QuotaLedger {
  grants: UploadGrants
}
/** One Submission and the grant tokens asked for. */
export interface AdmitRequest {
  submissionId: string
  tokens: string[]
}

// A resumable upload started under a grant can finish after the grant ends.
// The ledger keeps the reservation for a resumable session's lifetime (one
// week), so a late finish was already counted.
export const RESERVATION_MS = 7 * 24 * 60 * 60 * 1000

const SLOTS = 10
const LEDGER_WRITE_ATTEMPTS = 6

export class AdmissionError extends Error {
  constructor(
    readonly status: 400 | 429,
    readonly reason:
      'invalid_request' | 'quota_exceeded' | 'too_many_open_submissions',
  ) {
    super(reason)
  }
}

/** Use this function to keep only the grants storage.rules would still accept. */
export function liveGrants(grants: UploadGrants, now: number): UploadGrants {
  return Object.fromEntries(
    Object.entries(grants).filter(([, grant]) => grant.e > now),
  )
}

/**
 * Use this function to validate an admission request body: a photo slot,
 * `{ submissionId, slot, raw }`, or the final metadata,
 * `{ submissionId, metadata: true }`.
 */
export function parseAdmitRequest(body: unknown): AdmitRequest {
  const value = body as {
    submissionId?: unknown
    slot?: unknown
    raw?: unknown
    metadata?: unknown
  } | null
  if (!value || !validId(value.submissionId))
    throw new AdmissionError(400, 'invalid_request')
  const { submissionId } = value
  if (value.metadata !== undefined) {
    if (
      value.metadata !== true ||
      value.slot !== undefined ||
      value.raw !== undefined
    )
      throw new AdmissionError(400, 'invalid_request')
    return { submissionId, tokens: [grantToken(METADATA_FILE_NAME)] }
  }
  const { slot, raw } = value
  if (
    typeof slot !== 'number' ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= SLOTS ||
    typeof raw !== 'boolean'
  )
    throw new AdmissionError(400, 'invalid_request')
  return {
    submissionId,
    tokens: [
      grantToken(photoFileName(slot)),
      ...(raw ? [grantToken(rawPhotoFileName(slot))] : []),
    ],
  }
}

const reservedBytes = (token: string) =>
  token === METADATA_FILE_NAME
    ? MAX_METADATA_BYTES
    : token.endsWith('.dng')
      ? MAX_RAW_PHOTO_BYTES
      : MAX_PHOTO_BYTES

/**
 * Use this function to decide one admission. `stored` maps each of the
 * uid's object names to its size. Returns the next ledger grants, or throws
 * when the grant would pass the quota.
 */
export function admit(
  uid: string,
  ledger: QuotaLedger,
  stored: ReadonlyMap<string, number>,
  request: AdmitRequest,
  now: number,
): UploadGrants {
  const grants: UploadGrants = Object.fromEntries(
    Object.entries(ledger.grants).filter(
      ([, grant]) => grant.e + RESERVATION_MS > now,
    ),
  )
  const { tokens } = request
  const current = grants[request.submissionId]
  grants[request.submissionId] = {
    e: now + UPLOAD_GRANT_TTL_MS,
    f: [...new Set([...(current?.f ?? []), ...tokens])],
  }
  if (Object.keys(liveGrants(grants, now)).length > MAX_GRANTED_SUBMISSIONS)
    throw new AdmissionError(429, 'too_many_open_submissions')

  const usage = new Map(stored)
  for (const [submissionId, grant] of Object.entries(grants)) {
    for (const token of grant.f) {
      const name = `${submissionPrefix(uid, submissionId)}${fileNameForToken(token)}`
      usage.set(name, Math.max(usage.get(name) ?? 0, reservedBytes(token)))
    }
  }
  let bytes = 0
  for (const size of usage.values()) bytes += size
  if (
    usage.size > MAX_UPLOAD_OBJECTS_PER_UID ||
    bytes > MAX_UPLOAD_BYTES_PER_UID
  )
    throw new AdmissionError(429, 'quota_exceeded')
  return grants
}

export interface AdmissionPorts {
  verifyIdToken(token: string): Promise<{ uid: string }>
  readLedger(uid: string): Promise<{ value: QuotaLedger; generation: number }>
  /** Writes only if the ledger is still at `generation`; false on a conflict. */
  writeLedger(
    uid: string,
    value: QuotaLedger,
    generation: number,
  ): Promise<boolean>
  /** Every object under the uid's submissions/ folder, name → size. */
  listStored(uid: string): Promise<Map<string, number>>
  /** Copies the live grants into the uid's custom claims. */
  publishGrants(uid: string, grants: UploadGrants): Promise<void>
  now(): number
}

export interface AdmissionResponse {
  status: number
  body?: { expiresAt: number } | { error: string }
}

/** Use this function to serve one admission request. */
export async function handleAdmitPhotoUpload(
  { authorization, body }: { authorization: string | undefined; body: unknown },
  ports: AdmissionPorts,
): Promise<AdmissionResponse> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return { status: 401 }
  let uid: string
  try {
    ;({ uid } = await ports.verifyIdToken(token))
  } catch {
    return { status: 401 }
  }
  try {
    const request = parseAdmitRequest(body)
    for (let attempt = 0; attempt < LEDGER_WRITE_ATTEMPTS; attempt++) {
      const { value, generation } = await ports.readLedger(uid)
      // Listed after the ledger read: an object written under a grant this
      // admission prunes has already landed, so it is in the listing.
      const stored = await ports.listStored(uid)
      const now = ports.now()
      const grants = admit(uid, value, stored, request, now)
      if (!(await ports.writeLedger(uid, { grants }, generation))) continue
      await ports.publishGrants(uid, liveGrants(grants, now))
      return {
        status: 200,
        body: { expiresAt: grants[request.submissionId].e },
      }
    }
    return { status: 503, body: { error: 'concurrent_admission' } }
  } catch (error) {
    if (error instanceof AdmissionError)
      return { status: error.status, body: { error: error.reason } }
    throw error
  }
}
