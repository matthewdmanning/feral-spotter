/**
 * Consent records (ADR-0009): proof of each consent choice an account made,
 * plus its current choices so a new device or reinstall need not ask again.
 * Firestore is server-only (ADR-0008); this is the one entrypoint.
 *
 * On account erasure the records shrink to a pseudonymous tombstone, kept
 * CONSENT_TOMBSTONE_RETENTION_DAYS to defend a claim (GDPR Art. 17(3)(e)),
 * then deleted by Firestore TTL.
 */

import { createHash } from 'node:crypto'

export const CONSENT_KINDS = [
  'data_collection',
  'analytics',
  'email_updates',
] as const
export type ConsentKind = (typeof CONSENT_KINDS)[number]

/** Three years: a common limitation period for a consent dispute. */
export const CONSENT_TOMBSTONE_RETENTION_DAYS = 3 * 365

/** One choice as the client reports it. */
export interface ConsentChoice {
  kind: ConsentKind
  granted: boolean
  /** Disclosure version the user saw (app CONSENT_VERSION). */
  version: number
  /** When the user chose, on the device clock (ISO 8601). */
  chosenAt: string
  platform: string
  appVersion: string
}

/** A stored choice: the client's report plus the server's receipt time. */
export interface ConsentEvent extends ConsentChoice {
  recordedAt: string
}

export type ConsentSnapshot = Partial<
  Record<ConsentKind, Pick<ConsentEvent, 'granted' | 'version' | 'chosenAt'>>
>

/** What survives erasure: no uid, email, platform or app version. */
export interface ConsentTombstone {
  events: Pick<
    ConsentEvent,
    'kind' | 'granted' | 'version' | 'chosenAt' | 'recordedAt'
  >[]
  erasedAt: string
  /** Firestore TTL field: the tombstone is deleted after this. */
  expireAt: Date
}

export interface ConsentRecordDb {
  /** Append and update current choices atomically. False when erasure has begun. */
  append(uid: string, event: ConsentEvent): Promise<boolean>
  snapshot(uid: string): Promise<ConsentSnapshot>
  events(uid: string): Promise<ConsentEvent[]>
  tombstone(key: string): Promise<Omit<ConsentTombstone, 'events'> | null>
  /** Block new writes before reading events to retire. */
  beginRetirement(key: string, tombstone: ConsentTombstone): Promise<Date>
  /** Retain the minimal events, then delete the account's events and snapshot. */
  retire(uid: string, key: string, tombstone: ConsentTombstone): Promise<void>
}

/** Pseudonymous key: the same uid always maps to it; it names no one. */
export function tombstoneKey(uid: string): string {
  return createHash('sha256').update(`consent:${uid}`).digest('hex')
}

const MAX_TEXT = 64

function text(value: unknown): string | null {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_TEXT
    ? value
    : null
}

/** The request body as a choice, or null when any field is invalid. */
export function parseConsentChoice(body: unknown): ConsentChoice | null {
  const b = (body ?? {}) as Record<string, unknown>
  const kind = CONSENT_KINDS.find((k) => k === b.kind)
  const chosenAt = text(b.chosenAt)
  const platform = text(b.platform)
  const appVersion = text(b.appVersion)
  if (
    !kind ||
    typeof b.granted !== 'boolean' ||
    typeof b.version !== 'number' ||
    !Number.isInteger(b.version) ||
    b.version < 0 ||
    !chosenAt ||
    Number.isNaN(Date.parse(chosenAt)) ||
    !platform ||
    !appVersion
  ) {
    return null
  }
  return {
    kind,
    granted: b.granted,
    version: b.version,
    chosenAt: new Date(chosenAt).toISOString(),
    platform,
    appVersion,
  }
}

export interface ConsentRequest {
  method: string
  authorization: string | undefined
  body: unknown
}

export interface ConsentResponse {
  status: number
  body?: ConsentSnapshot
}

/**
 * GET: the caller's current choices. POST: record one choice. The uid comes
 * from the verified ID token only. An erased account's leftover token is
 * refused (410), so an in-flight request cannot recreate its records.
 */
export async function handleConsentRecords(
  { method, authorization, body }: ConsentRequest,
  db: ConsentRecordDb,
  verifyIdToken: (token: string) => Promise<{ uid: string }>,
  now: () => Date = () => new Date(),
): Promise<ConsentResponse> {
  if (method !== 'GET' && method !== 'POST') return { status: 405 }
  const token = authorization?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return { status: 401 }
  let uid: string
  try {
    uid = (await verifyIdToken(token)).uid
  } catch {
    return { status: 401 }
  }
  if (await db.tombstone(tombstoneKey(uid))) return { status: 410 }

  if (method === 'GET') return { status: 200, body: await db.snapshot(uid) }

  const choice = parseConsentChoice(body)
  if (!choice) return { status: 400 }
  const appended = await db.append(uid, {
    ...choice,
    recordedAt: now().toISOString(),
  })
  return { status: appended ? 204 : 410 }
}

/** Block new writes, retain proof, then remove the live account records. */
export async function retireConsentRecords(
  uid: string,
  db: ConsentRecordDb,
  now: Date = new Date(),
): Promise<void> {
  const key = tombstoneKey(uid)
  const expireAt = new Date(now)
  expireAt.setUTCDate(expireAt.getUTCDate() + CONSENT_TOMBSTONE_RETENTION_DAYS)
  const marker = { events: [], erasedAt: now.toISOString(), expireAt }
  const retentionDeadline = await db.beginRetirement(key, marker)

  const events = await db.events(uid)
  await db.retire(uid, key, {
    ...marker,
    expireAt: retentionDeadline,
    events: events.map(({ kind, granted, version, chosenAt, recordedAt }) => ({
      kind,
      granted,
      version,
      chosenAt,
      recordedAt,
    })),
  })
}
