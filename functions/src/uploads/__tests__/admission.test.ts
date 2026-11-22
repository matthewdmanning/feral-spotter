import {
  MAX_GRANTED_SUBMISSIONS,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BYTES_PER_UID,
  MAX_UPLOAD_OBJECTS_PER_UID,
  UPLOAD_GRANT_TTL_MS,
  submissionPrefix,
} from '../../submissionLayout'
import {
  RESERVATION_MS,
  admit,
  handleAdmitPhotoUpload,
  type AdmissionPorts,
  type QuotaLedger,
  type UploadGrants,
} from '../admission'

/**
 * #486: the quota is hard only if every grant a token can carry was counted
 * against stored bytes plus open reservations, and concurrent admissions
 * cannot both spend the same headroom.
 */

const UID = 'uid-1'
const NOW = 1_800_000_000_000
const empty: QuotaLedger = { grants: {} }
const photo = (sub: string, file: string) =>
  `${submissionPrefix(UID, sub)}${file}`

/** Stored objects that leave exactly `headroom` bytes under the quota. */
function storedWithHeadroom(headroom: number): Map<string, number> {
  return new Map([
    [photo('old', 'photo-0.jpg'), MAX_UPLOAD_BYTES_PER_UID - headroom],
  ])
}

describe('admit', () => {
  it('reserves the per-object maximum for each granted name', () => {
    const grants = admit(
      UID,
      empty,
      new Map(),
      { submissionId: 's1', slot: 3, raw: true },
      NOW,
    )
    expect(grants).toEqual({
      s1: { e: NOW + UPLOAD_GRANT_TTL_MS, f: ['3.jpg', '3.dng'] },
    })
  })

  it('counts orphaned photos and refuses a grant past the byte quota', () => {
    const request = { submissionId: 's1', slot: 0, raw: false }
    expect(() =>
      admit(UID, empty, storedWithHeadroom(MAX_PHOTO_BYTES), request, NOW),
    ).not.toThrow()
    expect(() =>
      admit(UID, empty, storedWithHeadroom(MAX_PHOTO_BYTES - 1), request, NOW),
    ).toThrow('quota_exceeded')
  })

  it('refuses a grant past the object quota', () => {
    const stored = new Map(
      Array.from({ length: MAX_UPLOAD_OBJECTS_PER_UID }, (_, i) => [
        photo(`s${i}`, 'photo-0.jpg'),
        1,
      ]),
    )
    expect(() =>
      admit(
        UID,
        empty,
        stored,
        { submissionId: 'new', slot: 0, raw: false },
        NOW,
      ),
    ).toThrow('quota_exceeded')
    // Overwriting an object already stored adds none.
    expect(() =>
      admit(
        UID,
        empty,
        stored,
        { submissionId: 's0', slot: 0, raw: false },
        NOW,
      ),
    ).not.toThrow()
  })

  it('counts a re-admitted slot once', () => {
    const request = { submissionId: 's1', slot: 0, raw: false }
    const first = admit(
      UID,
      empty,
      storedWithHeadroom(MAX_PHOTO_BYTES),
      request,
      NOW,
    )
    expect(() =>
      admit(
        UID,
        { grants: first },
        storedWithHeadroom(MAX_PHOTO_BYTES),
        request,
        NOW + 1,
      ),
    ).not.toThrow()
  })

  it('keeps a reservation after its grant ends, until a resumable session would have', () => {
    const request = { submissionId: 'other', slot: 0, raw: false }
    const ended: UploadGrants = { s1: { e: NOW, f: ['0.jpg'] } }
    const stored = storedWithHeadroom(MAX_PHOTO_BYTES)
    expect(() =>
      admit(UID, { grants: ended }, stored, request, NOW + 1),
    ).toThrow('quota_exceeded')
    expect(
      admit(UID, { grants: ended }, stored, request, NOW + RESERVATION_MS + 1),
    ).not.toHaveProperty('s1')
  })

  it('limits open Submissions so the claim fits', () => {
    let grants: UploadGrants = {}
    for (let i = 0; i < MAX_GRANTED_SUBMISSIONS; i++)
      grants = admit(
        UID,
        { grants },
        new Map(),
        { submissionId: `s${i}`, slot: 0, raw: false },
        NOW,
      )
    expect(() =>
      admit(
        UID,
        { grants },
        new Map(),
        { submissionId: 'extra', slot: 0, raw: false },
        NOW,
      ),
    ).toThrow('too_many_open_submissions')
    // An ended grant no longer occupies the claim.
    expect(() =>
      admit(
        UID,
        { grants },
        new Map(),
        { submissionId: 'extra', slot: 0, raw: false },
        NOW + UPLOAD_GRANT_TTL_MS,
      ),
    ).not.toThrow()
  })
})

/** In-memory ledger with real generation preconditions, as in GCS. */
function fakePorts(stored: Map<string, number>) {
  let ledger = { value: empty, generation: 0 }
  const published: UploadGrants[] = []
  const tick = () => new Promise((resolve) => setImmediate(resolve))
  const ports: AdmissionPorts = {
    verifyIdToken: async (token) => {
      if (token !== 'good') throw new Error('bad token')
      return { uid: UID }
    },
    readLedger: async () => {
      await tick()
      return ledger
    },
    writeLedger: async (_uid, value, generation) => {
      await tick()
      if (generation !== ledger.generation) return false
      ledger = { value, generation: generation + 1 }
      return true
    },
    listStored: async () => new Map(stored),
    publishGrants: async (_uid, grants) => {
      published.push(grants)
    },
    now: () => NOW,
  }
  return { ports, published, ledger: () => ledger.value }
}

const call = (ports: AdmissionPorts, body: unknown, token = 'good') =>
  handleAdmitPhotoUpload({ authorization: `Bearer ${token}`, body }, ports)

describe('handleAdmitPhotoUpload', () => {
  it('lets only one of two concurrent admissions spend the last headroom', async () => {
    const { ports, published, ledger } = fakePorts(
      storedWithHeadroom(MAX_PHOTO_BYTES),
    )
    const results = await Promise.all([
      call(ports, { submissionId: 's1', slot: 0, raw: false }),
      call(ports, { submissionId: 's2', slot: 0, raw: false }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 429])
    expect(Object.keys(ledger().grants)).toHaveLength(1)
    // Every grant a token can receive is one the ledger counts.
    for (const grants of published)
      for (const id of Object.keys(grants))
        expect(ledger().grants[id]).toBeDefined()
  })

  it('refuses a missing or bad token and a malformed request', async () => {
    const { ports } = fakePorts(new Map())
    expect(
      (await call(ports, { submissionId: 's', slot: 0, raw: false }, 'bad'))
        .status,
    ).toBe(401)
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
    ])
      expect((await call(ports, body)).status).toBe(400)
  })
})
