/**
 * #486: hard upload limits per person, without a database.
 *
 * Storage rules cannot count objects or bytes, so a client may write an
 * object only under an upload grant: the Auth custom claim `uploadGrants`,
 * which storage.rules checks. This endpoint is the only issuer.
 *
 * Limits belong to a person, not an account. A person is every uid that
 * ever signed in with the same email, through any sign-in method. Their
 * ledger survives account erasure, so deleting and recreating an account
 * resets nothing:
 * - Submissions: 250 per person, counted for life. A metadata grant spends
 *   one; deleting the Submission does not refund it.
 * - Bytes and objects: live usage, summed over the person's uids, plus
 *   every open reservation.
 *
 * The ledger is authoritative and written with a generation precondition,
 * so admissions serialize per person. A claim is always a copy of some
 * ledger version, and the ledger never drops a grant before its
 * reservation ends, so every grant a token can carry is counted. A lost or
 * stale claim write only refuses an upload; the client asks again.
 * See ADR-0005.
 */
import { validId } from '../organizations/domain'
import {
  MAX_GRANTED_SUBMISSIONS,
  MAX_METADATA_BYTES,
  MAX_PHOTO_BYTES,
  MAX_RAW_PHOTO_BYTES,
  MAX_SUBMISSIONS_PER_UID,
  MAX_UPLOAD_BYTES_PER_UID,
  MAX_UPLOAD_OBJECTS_PER_UID,
  METADATA_FILE_NAME,
  UPLOAD_GRANT_TTL_MS,
  emailIndexPath,
  fileNameForToken,
  grantToken,
  parseSubmissionObject,
  photoFileName,
  rawPhotoFileName,
  submissionPrefix,
  uidIndexPath,
} from '../submissionLayout'

/** Grant tokens (`3.jpg`, `3.dng`, `metadata.json`) for one Submission, writable until `e` (epoch ms). */
export interface SubmissionGrant {
  e: number
  f: string[]
}
/** One uid's grants, by submissionId. This is the claim's shape. */
export type UploadGrants = Record<string, SubmissionGrant>

export interface PersonLedger {
  /** Accounts whose stored objects count against the person. */
  uids: string[]
  /** Open grants, by uid. */
  grants: Record<string, UploadGrants>
  /** `uid/submissionId` of every Submission admitted for a live account. */
  submissions: string[]
  /** Submissions of erased accounts whose Sightings were deleted. */
  retiredSubmissions: number
}
export const emptyLedger = (): PersonLedger => ({
  uids: [],
  grants: {},
  submissions: [],
  retiredSubmissions: 0,
})

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
      | 'invalid_request'
      | 'quota_exceeded'
      | 'submission_cap_reached'
      | 'too_many_open_submissions',
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

const withoutEnded = (grants: UploadGrants, now: number): UploadGrants =>
  Object.fromEntries(
    Object.entries(grants).filter(
      ([, grant]) => grant.e + RESERVATION_MS > now,
    ),
  )

/**
 * Use this function to decide one admission for `uid`. `stored` maps every
 * object name under the person's uids to its size. Returns the next ledger,
 * or throws when the grant would pass a limit.
 */
export function admit(
  ledger: PersonLedger,
  stored: ReadonlyMap<string, number>,
  uid: string,
  request: AdmitRequest,
  now: number,
): PersonLedger {
  const grants: Record<string, UploadGrants> = {}
  for (const [owner, owned] of Object.entries(ledger.grants)) {
    const kept = withoutEnded(owned, now)
    if (Object.keys(kept).length > 0) grants[owner] = kept
  }
  const own = { ...grants[uid] }
  const current = own[request.submissionId]
  own[request.submissionId] = {
    e: now + UPLOAD_GRANT_TTL_MS,
    f: [...new Set([...(current?.f ?? []), ...request.tokens])],
  }
  grants[uid] = own
  if (Object.keys(liveGrants(own, now)).length > MAX_GRANTED_SUBMISSIONS)
    throw new AdmissionError(429, 'too_many_open_submissions')

  // Lifetime Submissions: every one admitted, plus any stored before the
  // ledger knew of it (written before #486 deployed).
  const submissions = new Set(ledger.submissions)
  for (const name of stored.keys()) {
    const object = parseSubmissionObject(name)
    if (object?.isMetadata)
      submissions.add(`${object.uid}/${object.submissionId}`)
  }
  const key = `${uid}/${request.submissionId}`
  if (request.tokens.includes(METADATA_FILE_NAME) && !submissions.has(key)) {
    if (submissions.size + ledger.retiredSubmissions >= MAX_SUBMISSIONS_PER_UID)
      throw new AdmissionError(429, 'submission_cap_reached')
    submissions.add(key)
  }

  const usage = new Map(stored)
  for (const [owner, owned] of Object.entries(grants))
    for (const [submissionId, grant] of Object.entries(owned))
      for (const token of grant.f) {
        const name = `${submissionPrefix(owner, submissionId)}${fileNameForToken(token)}`
        usage.set(name, Math.max(usage.get(name) ?? 0, reservedBytes(token)))
      }
  let bytes = 0
  for (const size of usage.values()) bytes += size
  if (
    usage.size > MAX_UPLOAD_OBJECTS_PER_UID ||
    bytes > MAX_UPLOAD_BYTES_PER_UID
  )
    throw new AdmissionError(429, 'quota_exceeded')

  return {
    uids: [...new Set([...ledger.uids, uid])],
    grants,
    submissions: [...submissions],
    retiredSubmissions: ledger.retiredSubmissions,
  }
}

/**
 * Use this function when an account is erased. Its grants go. If its
 * Sightings are deleted too, its Submissions fold into a bare count, so the
 * ledger keeps no id of it but the person's lifetime total is unchanged.
 * Kept Sightings stay stored, so their uid keeps counting. Idempotent.
 */
export function retireUid(
  ledger: PersonLedger,
  uid: string,
  sightingsDeleted: boolean,
): PersonLedger {
  const grants = { ...ledger.grants }
  delete grants[uid]
  if (!sightingsDeleted) return { ...ledger, grants }
  const mine = ledger.submissions.filter((key) => key.startsWith(`${uid}/`))
  return {
    uids: ledger.uids.filter((u) => u !== uid),
    grants,
    submissions: ledger.submissions.filter((key) => !key.startsWith(`${uid}/`)),
    retiredSubmissions: ledger.retiredSubmissions + mine.length,
  }
}

/** Write-once pointers from a uid or an email key to its person. */
export interface PersonIndex {
  read(path: string): Promise<string | undefined>
  /** Binds `path` to `personId` unless already bound; returns the binding. */
  bind(path: string, personId: string): Promise<string>
  /** Keyed hash of a normalized email; never the address itself. */
  emailKey(email: string): string
}

/** Use this function to normalize an email before keying it. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Use this function to find, or found, the person a uid belongs to. A uid
 * keeps the person it was first bound to, so changing email moves nothing.
 * Every email the uid signs in with is bound to that person if still free,
 * so a later account with any of them joins it.
 */
export async function resolvePerson(
  index: PersonIndex,
  uid: string,
  email: string | undefined,
): Promise<string> {
  const emailPath = email
    ? emailIndexPath(index.emailKey(normalizeEmail(email)))
    : undefined
  let person = await index.read(uidIndexPath(uid))
  if (!person) {
    const fromEmail = emailPath ? await index.read(emailPath) : undefined
    person = await index.bind(
      uidIndexPath(uid),
      fromEmail ??
        (email ? index.emailKey(normalizeEmail(email)) : `uid-${uid}`),
    )
  }
  if (emailPath) await index.bind(emailPath, person)
  return person
}

export interface AdmissionPorts {
  verifyIdToken(token: string): Promise<{ uid: string; email?: string }>
  index: PersonIndex
  readLedger(
    personId: string,
  ): Promise<{ value: PersonLedger; generation: number }>
  /** Writes only if the ledger is still at `generation`; false on a conflict. */
  writeLedger(
    personId: string,
    value: PersonLedger,
    generation: number,
  ): Promise<boolean>
  /** Every object under these uids' submissions/ folders, name → size. */
  listStored(uids: string[]): Promise<Map<string, number>>
  /** Copies one uid's live grants into its custom claims. */
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
  let email: string | undefined
  try {
    ;({ uid, email } = await ports.verifyIdToken(token))
  } catch {
    return { status: 401 }
  }
  try {
    const request = parseAdmitRequest(body)
    const person = await resolvePerson(ports.index, uid, email)
    for (let attempt = 0; attempt < LEDGER_WRITE_ATTEMPTS; attempt++) {
      const { value, generation } = await ports.readLedger(person)
      // Listed after the ledger read: an object written under a grant this
      // admission prunes has already landed, so it is in the listing.
      const stored = await ports.listStored([...new Set([...value.uids, uid])])
      const now = ports.now()
      const next = admit(value, stored, uid, request, now)
      if (!(await ports.writeLedger(person, next, generation))) continue
      await ports.publishGrants(uid, liveGrants(next.grants[uid], now))
      return {
        status: 200,
        body: { expiresAt: next.grants[uid][request.submissionId].e },
      }
    }
    return { status: 503, body: { error: 'concurrent_admission' } }
  } catch (error) {
    if (error instanceof AdmissionError)
      return { status: error.status, body: { error: error.reason } }
    throw error
  }
}
