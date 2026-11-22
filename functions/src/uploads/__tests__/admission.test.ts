import {
  MAX_GRANTED_SUBMISSIONS,
  MAX_METADATA_BYTES,
  MAX_PHOTO_BYTES,
  MAX_SUBMISSIONS_PER_UID,
  MAX_UPLOAD_BYTES_PER_UID,
  MAX_UPLOAD_OBJECTS_PER_UID,
  UPLOAD_GRANT_TTL_MS,
  emailIndexPath,
  submissionPrefix,
  uidIndexPath,
} from '../../submissionLayout'
import {
  RESERVATION_MS,
  admit,
  emptyLedger,
  handleAdmitPhotoUpload,
  parseAdmitRequest,
  resolvePerson,
  retireUid,
  type AdmissionPorts,
  type PersonIndex,
  type PersonLedger,
} from '../admission'

/**
 * #486: limits are hard only if every grant a token can carry was counted,
 * concurrent admissions cannot both spend the same headroom, and a person
 * cannot reset them by adding a sign-in method, changing email, or erasing
 * and recreating the account.
 */

const UID = 'uid-1'
const NOW = 1_800_000_000_000
const empty = emptyLedger()
const name = (uid: string, sub: string, file: string) =>
  `${submissionPrefix(uid, sub)}${file}`
const req = (submissionId: string, slot: number, raw: boolean) =>
  parseAdmitRequest({ submissionId, slot, raw })
const meta = (submissionId: string) =>
  parseAdmitRequest({ submissionId, metadata: true })

/** Stored objects that leave exactly `headroom` bytes under the quota. */
const withHeadroom = (headroom: number, uid = UID) =>
  new Map([
    [name(uid, 'old', 'photo-0.jpg'), MAX_UPLOAD_BYTES_PER_UID - headroom],
  ])

describe('admit: bytes and objects', () => {
  it('reserves the per-object maximum for each granted name', () => {
    const next = admit(empty, new Map(), UID, req('s1', 3, true), NOW)
    expect(next.grants).toEqual({
      [UID]: { s1: { e: NOW + UPLOAD_GRANT_TTL_MS, f: ['3.jpg', '3.dng'] } },
    })
    expect(next.uids).toEqual([UID])
  })

  it('sums live bytes over every account of the person, orphans included', () => {
    // The listing spans the person's uids; another account's bytes count.
    const stored = withHeadroom(MAX_PHOTO_BYTES - 1, 'uid-other-method')
    expect(() => admit(empty, stored, UID, req('s1', 0, false), NOW)).toThrow(
      'quota_exceeded',
    )
    expect(() =>
      admit(
        empty,
        withHeadroom(MAX_PHOTO_BYTES),
        UID,
        req('s1', 0, false),
        NOW,
      ),
    ).not.toThrow()
  })

  it('counts another account’s open reservations', () => {
    const theirs = admit(empty, new Map(), 'uid-b', req('s9', 0, false), NOW)
    expect(() =>
      admit(
        theirs,
        withHeadroom(MAX_PHOTO_BYTES),
        UID,
        req('s1', 0, false),
        NOW,
      ),
    ).toThrow('quota_exceeded')
  })

  it('refuses a grant past the object quota, but not an overwrite', () => {
    const stored = new Map(
      Array.from({ length: MAX_UPLOAD_OBJECTS_PER_UID }, (_, i) => [
        name(UID, `s${i}`, 'photo-0.jpg'),
        1,
      ]),
    )
    expect(() => admit(empty, stored, UID, req('new', 0, false), NOW)).toThrow(
      'quota_exceeded',
    )
    expect(() =>
      admit(empty, stored, UID, req('s0', 0, false), NOW),
    ).not.toThrow()
  })

  it('counts a re-admitted slot once', () => {
    const first = admit(
      empty,
      withHeadroom(MAX_PHOTO_BYTES),
      UID,
      req('s1', 0, false),
      NOW,
    )
    expect(() =>
      admit(
        first,
        withHeadroom(MAX_PHOTO_BYTES),
        UID,
        req('s1', 0, false),
        NOW + 1,
      ),
    ).not.toThrow()
  })

  it('counts metadata.json, reserving its bound', () => {
    expect(() =>
      admit(empty, withHeadroom(MAX_METADATA_BYTES - 1), UID, meta('s1'), NOW),
    ).toThrow('quota_exceeded')
    expect(() =>
      admit(empty, withHeadroom(MAX_METADATA_BYTES), UID, meta('s1'), NOW),
    ).not.toThrow()
  })

  it('keeps a reservation after its grant ends, until a resumable session would have', () => {
    const ended: PersonLedger = {
      ...empty,
      grants: { [UID]: { s1: { e: NOW, f: ['0.jpg'] } } },
    }
    const stored = withHeadroom(MAX_PHOTO_BYTES)
    expect(() =>
      admit(ended, stored, UID, req('other', 0, false), NOW + 1),
    ).toThrow('quota_exceeded')
    expect(
      admit(
        ended,
        stored,
        UID,
        req('other', 0, false),
        NOW + RESERVATION_MS + 1,
      ).grants[UID],
    ).not.toHaveProperty('s1')
  })

  it('limits one account’s open Submissions so its claim fits', () => {
    let ledger = empty
    for (let i = 0; i < MAX_GRANTED_SUBMISSIONS; i++)
      ledger = admit(ledger, new Map(), UID, req(`s${i}`, 0, false), NOW)
    expect(() =>
      admit(ledger, new Map(), UID, req('extra', 0, false), NOW),
    ).toThrow('too_many_open_submissions')
    // Another account of the person has its own claim.
    expect(() =>
      admit(ledger, new Map(), 'uid-b', req('extra', 0, false), NOW),
    ).not.toThrow()
    expect(() =>
      admit(
        ledger,
        new Map(),
        UID,
        req('extra', 0, false),
        NOW + UPLOAD_GRANT_TTL_MS,
      ),
    ).not.toThrow()
  })
})

describe('admit: lifetime Submission cap', () => {
  const atCap = (retired: number): PersonLedger => ({
    ...empty,
    submissions: Array.from(
      { length: MAX_SUBMISSIONS_PER_UID - retired },
      (_, i) => `uid-${i % 3}/sub-${i}`,
    ),
    retiredSubmissions: retired,
  })

  it('refuses the next Submission once the person has made the cap, across accounts and erasures', () => {
    for (const retired of [0, 100, MAX_SUBMISSIONS_PER_UID])
      expect(() =>
        admit(atCap(retired), new Map(), UID, meta('new'), NOW),
      ).toThrow('submission_cap_reached')
  })

  it('never refunds: a deleted Submission still counts', () => {
    // The ledger remembers sub-0 even though no metadata.json is stored.
    expect(() => admit(atCap(0), new Map(), UID, meta('new'), NOW)).toThrow(
      'submission_cap_reached',
    )
  })

  it('lets an admitted Submission resend its metadata, and photos still flow', () => {
    const ledger = atCap(0)
    const [uid, sub] = ledger.submissions[0].split('/')
    expect(() => admit(ledger, new Map(), uid, meta(sub), NOW)).not.toThrow()
    expect(() =>
      admit(ledger, new Map(), UID, req('new', 0, false), NOW),
    ).not.toThrow()
  })

  it('counts Submissions stored before the ledger knew them', () => {
    const stored = new Map(
      Array.from({ length: MAX_SUBMISSIONS_PER_UID }, (_, i) => [
        name(UID, `pre-${i}`, 'metadata.json'),
        2,
      ]),
    )
    expect(() => admit(empty, stored, UID, meta('new'), NOW)).toThrow(
      'submission_cap_reached',
    )
    const next = admit(empty, stored, UID, req('new', 0, false), NOW)
    expect(next.submissions).toHaveLength(MAX_SUBMISSIONS_PER_UID)
  })
})

describe('retireUid', () => {
  const ledger = admit(
    admit(empty, new Map(), UID, meta('a'), NOW),
    new Map(),
    'uid-b',
    meta('b'),
    NOW,
  )

  it('folds an erased account’s Submissions into a count, keeping the total', () => {
    const retired = retireUid(ledger, UID, true)
    expect(retired.uids).toEqual([UID, 'uid-b'])
    expect(retired.deletedUids).toEqual([UID])
    expect(retired.submissions).toEqual(['uid-b/b'])
    expect(retired.retiredSubmissions).toBe(1)
    expect(retired.grants[UID]).toEqual(ledger.grants[UID])
    // A retry changes nothing.
    expect(retireUid(retired, UID, true)).toEqual(retired)
  })

  it('keeps counting an account whose Sightings stay stored', () => {
    const kept = retireUid(ledger, UID, false)
    expect(kept.uids).toContain(UID)
    expect(kept.submissions).toContain(`${UID}/a`)
    expect(kept.grants[UID]).toEqual(ledger.grants[UID])
  })

  it('removes a deleted UID once its objects and reservations are gone', () => {
    const retired = retireUid(ledger, UID, true)
    const afterExpiry = NOW + UPLOAD_GRANT_TTL_MS + RESERVATION_MS
    const late = new Map([[name(UID, 'a', 'metadata.json'), 1]])
    const whileStored = admit(
      retired,
      late,
      'uid-b',
      req('c', 0, false),
      afterExpiry,
    )
    expect(whileStored.uids).toContain(UID)
    expect(whileStored.submissions).toEqual(['uid-b/b'])
    expect(
      admit(whileStored, new Map(), 'uid-b', req('c', 0, false), afterExpiry),
    ).toMatchObject({ uids: ['uid-b'], deletedUids: [], retiredSubmissions: 1 })
  })
})

/** In-memory write-once index; the key is a readable stand-in for the HMAC. */
function fakeIndex(): PersonIndex & { paths: Map<string, string> } {
  const paths = new Map<string, string>()
  return {
    paths,
    read: async (path) => paths.get(path),
    bind: async (path, personId) => {
      if (!paths.has(path)) paths.set(path, personId)
      return paths.get(path)!
    },
    emailKey: (email) => `key(${email})`,
  }
}

describe('resolvePerson', () => {
  it('joins every sign-in method with the same email, whatever its case', async () => {
    const index = fakeIndex()
    const google = await resolvePerson(index, 'uid-google', 'Me@Example.com')
    const password = await resolvePerson(
      index,
      'uid-password',
      ' me@example.com ',
    )
    expect(password).toBe(google)
  })

  it('keeps the person through an email change, and claims the new address', async () => {
    const index = fakeIndex()
    const person = await resolvePerson(index, 'uid-1', 'old@example.com')
    expect(await resolvePerson(index, 'uid-1', 'new@example.com')).toBe(person)
    expect(await resolvePerson(index, 'uid-new', 'new@example.com')).toBe(
      person,
    )
  })

  it('finds the person again after erasure drops the uid pointer', async () => {
    const index = fakeIndex()
    const person = await resolvePerson(index, 'uid-1', 'me@example.com')
    index.paths.delete(uidIndexPath('uid-1'))
    expect(index.paths.get(emailIndexPath('key(me@example.com)'))).toBe(person)
    expect(await resolvePerson(index, 'uid-2', 'me@example.com')).toBe(person)
  })

  it('gives an account without an email a person of its own', async () => {
    const index = fakeIndex()
    expect(await resolvePerson(index, 'uid-1', undefined)).toMatch(
      /^uid-[a-f0-9]{64}$/,
    )
  })
})

/** In-memory ports with real generation preconditions, as in GCS. */
function fakePorts(stored: Map<string, number>) {
  const ledgers = new Map<string, { value: PersonLedger; generation: number }>()
  const tick = () => new Promise((resolve) => setImmediate(resolve))
  const ports: AdmissionPorts = {
    verifyIdToken: async (token) => {
      if (!token.startsWith('good-')) throw new Error('bad token')
      return {
        uid: token.slice(5),
        email: 'me@example.com',
        emailVerified: true,
      }
    },
    index: fakeIndex(),
    readLedger: async (person) => {
      await tick()
      return ledgers.get(person) ?? { value: emptyLedger(), generation: 0 }
    },
    writeLedger: async (person, value, generation) => {
      await tick()
      if (generation !== (ledgers.get(person)?.generation ?? 0)) return false
      ledgers.set(person, { value, generation: generation + 1 })
      return true
    },
    listStored: async () => new Map(stored),
    publishGrants: async () => {},
    now: () => NOW,
  }
  return { ports, ledgers }
}

const call = (ports: AdmissionPorts, body: unknown, token = `good-${UID}`) =>
  handleAdmitPhotoUpload({ authorization: `Bearer ${token}`, body }, ports)

describe('handleAdmitPhotoUpload', () => {
  it('lets only one of two accounts of a person spend the last headroom', async () => {
    const { ports, ledgers } = fakePorts(withHeadroom(MAX_PHOTO_BYTES))
    const results = await Promise.all([
      call(ports, { submissionId: 's1', slot: 0, raw: false }, 'good-uid-a'),
      call(ports, { submissionId: 's2', slot: 0, raw: false }, 'good-uid-b'),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 429])
    expect(ledgers.size).toBe(1)
  })

  it('refuses a missing or bad token and a malformed request', async () => {
    const { ports } = fakePorts(new Map())
    const valid = { submissionId: 's', slot: 0, raw: false }
    expect((await call(ports, valid, 'bad')).status).toBe(401)
    expect(
      (
        await handleAdmitPhotoUpload(
          { authorization: undefined, body: {} },
          ports,
        )
      ).status,
    ).toBe(401)
    for (const body of [
      { submissionId: 's', slot: 10, raw: false },
      { submissionId: '../x', slot: 0, raw: false },
      { submissionId: 's', slot: 0 },
      { submissionId: 's', slot: 0, raw: false, metadata: true },
    ])
      expect((await call(ports, body)).status).toBe(400)
  })
})
