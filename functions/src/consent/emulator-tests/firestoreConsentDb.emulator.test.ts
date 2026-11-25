import { deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { retireConsentRecords, tombstoneKey } from '../consentRecords'
import { firestoreConsentDb as db } from '../firestoreConsentDb'

/**
 * The Firestore adapter against the emulator: a late older choice must not
 * become current, and erasure must leave only the tombstone, with a real
 * Timestamp in the TTL field.
 */

let app: App
const uid = `consent-${process.pid}-${Date.now()}`
const event = (
  kind: 'analytics' | 'email_updates',
  chosenAt: string,
  granted: boolean,
) => ({
  kind,
  granted,
  version: 2,
  chosenAt,
  platform: 'android',
  appVersion: '1.0.0',
  recordedAt: new Date().toISOString(),
})

beforeAll(() => {
  app = initializeApp({
    projectId: process.env.GCLOUD_PROJECT ?? 'demo-consent',
  })
})
afterAll(() => deleteApp(app))

test('a late older choice is history, not the current choice', async () => {
  await db.append(uid, event('analytics', '2026-11-25T10:00:00.000Z', false))
  await db.append(uid, event('analytics', '2026-11-25T09:00:00.000Z', true))
  await db.append(uid, event('email_updates', '2026-11-25T09:30:00.000Z', true))

  expect(await db.snapshot(uid)).toEqual({
    analytics: {
      granted: false,
      version: 2,
      chosenAt: '2026-11-25T10:00:00.000Z',
    },
    email_updates: {
      granted: true,
      version: 2,
      chosenAt: '2026-11-25T09:30:00.000Z',
    },
  })
  expect(await db.events(uid)).toHaveLength(3)
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
  expect(raw?.events).toHaveLength(3)
  expect(await db.events(uid)).toEqual([])
  expect(await db.snapshot(uid)).toEqual({})
  expect((await db.tombstone(tombstoneKey(uid)))?.expireAt).toBeInstanceOf(Date)
})
