import { deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { retireConsentRecords, tombstoneKey } from '../consentRecords'
import { firestoreConsentDb as db } from '../firestoreConsentDb'

/**
 * The Firestore adapter against the emulator: device clocks must not order
 * current choices (a device running ahead cannot keep a stale grant over a
 * later revocation), retries must not duplicate history, and erasure must
 * leave only the tombstone, with a real Timestamp in the TTL field.
 */

let app: App
const uid = `consent-${process.pid}-${Date.now()}`
const event = (
  kind: 'analytics' | 'email_updates',
  chosenAt: string,
  granted: boolean,
  basedOnRevision: number,
) => ({
  kind,
  granted,
  version: 2,
  chosenAt,
  platform: 'android',
  appVersion: '1.0.0',
  basedOnRevision,
  recordedAt: new Date().toISOString(),
})

beforeAll(() => {
  app = initializeApp({
    projectId: process.env.GCLOUD_PROJECT ?? 'demo-consent',
  })
})
afterAll(() => deleteApp(app))

test('a revocation stays current over a grant from a fast device clock', async () => {
  // Device A's clock runs a day ahead.
  expect(
    await db.append(
      uid,
      event('analytics', '2026-11-26T10:00:00.000Z', true, 0),
    ),
  ).toBe(1)
  // Device B, correctly timed, revokes after seeing that grant.
  const revoke = event('analytics', '2026-11-25T11:00:00.000Z', false, 1)
  expect(await db.append(uid, revoke)).toBe(2)
  // A retries an offline grant chosen before it knew of the revocation.
  await db.append(uid, event('analytics', '2026-11-26T11:00:00.000Z', true, 1))
  // A lost response makes B send the same revocation again.
  await db.append(uid, { ...revoke, recordedAt: '2026-11-25T12:00:00.000Z' })
  await db.append(
    uid,
    event('email_updates', '2026-11-25T09:30:00.000Z', true, 3),
  )

  expect(await db.snapshot(uid)).toEqual({
    revision: 4,
    analytics: {
      granted: false,
      version: 2,
      chosenAt: '2026-11-25T11:00:00.000Z',
      revision: 2,
    },
    email_updates: {
      granted: true,
      version: 2,
      chosenAt: '2026-11-25T09:30:00.000Z',
      revision: 4,
    },
  })
  expect(await db.events(uid)).toHaveLength(4)
})

test('erasure leaves only the tombstone, with a TTL timestamp', async () => {
  const now = new Date('2026-11-25T12:00:00.000Z')
  await retireConsentRecords(uid, db, now)

  const raw = (
    await getFirestore()
      .collection('consentTombstones')
      .doc(tombstoneKey(uid))
      .get()
  ).data()
  expect(raw?.expireAt?.toDate()).toEqual(new Date('2029-11-24T12:00:00.000Z'))
  const events = await getFirestore()
    .collection('consentTombstoneEvents')
    .where('tombstoneKey', '==', tombstoneKey(uid))
    .get()
  expect(events.size).toBe(4)
  expect(
    events.docs.every((doc) => doc.get('expireAt').isEqual(raw?.expireAt)),
  ).toBe(true)
  expect(
    await db.append(
      uid,
      event('analytics', '2026-11-25T11:00:00.000Z', true, 4),
    ),
  ).toBeNull()
  expect(await db.events(uid)).toEqual([])
  expect(await db.snapshot(uid)).toEqual({ revision: 0 })
  expect((await db.tombstone(tombstoneKey(uid)))?.expireAt).toBeInstanceOf(Date)
})
