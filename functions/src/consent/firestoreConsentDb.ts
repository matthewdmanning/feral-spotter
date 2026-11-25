/**
 * Firestore layout for consent records (ADR-0009):
 *   consentRecords/{uid}                 current choices, one field per kind
 *   consentRecords/{uid}/events/{hash}   every choice, append-only
 *   consentTombstones/{sha256}           marker blocking writes after erasure
 *   consentTombstoneEvents/{hash}      retained minimal events with individual TTLs
 * Rules deny all client access; only this module writes.
 */

import { createHash } from 'node:crypto'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import {
  CONSENT_KINDS,
  nextCurrentChoice,
  tombstoneKey,
  type ConsentEvent,
  type ConsentKind,
  type ConsentRecordDb,
  type ConsentSnapshot,
} from './consentRecords'

const db = () => getFirestore()
const recordRef = (uid: string) => db().collection('consentRecords').doc(uid)
const tombstoneRef = (key: string) =>
  db().collection('consentTombstones').doc(key)

type StoredSnapshot = ConsentSnapshot

export const firestoreConsentDb: ConsentRecordDb = {
  append: (uid, event) =>
    db().runTransaction(async (transaction) => {
      const ref = recordRef(uid)
      const retired = await transaction.get(tombstoneRef(tombstoneKey(uid)))
      if (retired.exists) return null
      // Retrying after a lost response must not create another audit event.
      const id = createHash('sha256')
        .update(
          JSON.stringify([
            event.kind,
            event.granted,
            event.version,
            event.chosenAt,
            event.platform,
            event.appVersion,
            event.basedOnRevision,
          ]),
        )
        .digest('hex')
      const eventRef = ref.collection('events').doc(id)
      const [existing, snapshot] = await Promise.all([
        transaction.get(eventRef),
        transaction.get(ref),
      ])
      const current = snapshot.data() as StoredSnapshot | undefined
      if (existing.exists) return current?.revision ?? 0
      const revision = (current?.revision ?? 0) + 1
      transaction.create(eventRef, event)
      const update: Record<string, unknown> = { revision }
      if (nextCurrentChoice(current?.[event.kind], event)) {
        update[event.kind] = {
          granted: event.granted,
          version: event.version,
          chosenAt: event.chosenAt,
          revision,
        }
      }
      transaction.set(ref, update, { merge: true })
      return revision
    }),

  snapshot: async (uid) => {
    const data = (await recordRef(uid).get()).data() as
      StoredSnapshot | undefined
    const snapshot: ConsentSnapshot = { revision: data?.revision ?? 0 }
    for (const kind of CONSENT_KINDS as readonly ConsentKind[]) {
      const choice = data?.[kind]
      if (choice) snapshot[kind] = choice
    }
    return snapshot
  },

  events: async (uid) => {
    const docs = await recordRef(uid)
      .collection('events')
      .orderBy('recordedAt')
      .get()
    return docs.docs.map((doc) => doc.data() as ConsentEvent)
  },

  tombstone: async (key) => {
    const data = (await tombstoneRef(key).get()).data()
    if (!data) return null
    return {
      erasedAt: data.erasedAt as string,
      expireAt: (data.expireAt as Timestamp).toDate(),
    }
  },

  beginRetirement: (key, tombstone) =>
    db().runTransaction(async (transaction) => {
      const ref = tombstoneRef(key)
      const existingExpiry = (await transaction.get(ref)).get('expireAt') as
        Timestamp | undefined
      if (existingExpiry) return existingExpiry.toDate()
      transaction.create(ref, {
        erasedAt: tombstone.erasedAt,
        expireAt: Timestamp.fromDate(tombstone.expireAt),
      })
      return tombstone.expireAt
    }),

  retire: async (uid, key, tombstone) => {
    // Each event has its own TTL document, so history can grow beyond Firestore's
    // document limit. Stable IDs make partial writes and concurrent retries safe.
    const firestore = db()
    const retained = firestore.collection('consentTombstoneEvents')
    const writer = firestore.bulkWriter()
    const expireAt = Timestamp.fromDate(tombstone.expireAt)
    const copies = tombstone.events.map((event) => {
      const id = createHash('sha256')
        .update(JSON.stringify([key, event]))
        .digest('hex')
      return writer.set(retained.doc(id), {
        ...event,
        tombstoneKey: key,
        expireAt,
      })
    })
    await Promise.all([writer.close(), Promise.all(copies)])
    await db().recursiveDelete(recordRef(uid))
  },
}
