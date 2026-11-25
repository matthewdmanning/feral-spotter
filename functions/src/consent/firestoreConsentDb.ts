/**
 * Firestore layout for consent records (ADR-0009):
 *   consentRecords/{uid}                 current choices, one field per kind
 *   consentRecords/{uid}/events/{auto}   every choice, append-only
 *   consentTombstones/{sha256}           erased account's minimal history
 * Rules deny all client access; only this module writes.
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type {
  ConsentEvent,
  ConsentKind,
  ConsentRecordDb,
  ConsentSnapshot,
  ConsentTombstone,
} from './consentRecords'

const db = () => getFirestore()
const recordRef = (uid: string) => db().collection('consentRecords').doc(uid)
const tombstoneRef = (key: string) =>
  db().collection('consentTombstones').doc(key)

type StoredSnapshot = ConsentSnapshot

export const firestoreConsentDb: ConsentRecordDb = {
  append: async (uid, event) => {
    await db().runTransaction(async (transaction) => {
      const ref = recordRef(uid)
      const current = (await transaction.get(ref)).data() as
        StoredSnapshot | undefined
      transaction.create(ref.collection('events').doc(), event)
      // A late-arriving older choice is kept as history, never as current.
      const previous = current?.[event.kind]
      if (previous && previous.chosenAt > event.chosenAt) return
      transaction.set(
        ref,
        {
          [event.kind]: {
            granted: event.granted,
            version: event.version,
            chosenAt: event.chosenAt,
          },
        },
        { merge: true },
      )
    })
  },

  snapshot: async (uid) => {
    const data = (await recordRef(uid).get()).data() as
      StoredSnapshot | undefined
    const snapshot: ConsentSnapshot = {}
    for (const kind of Object.keys(data ?? {}) as ConsentKind[]) {
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
      ...(data as Omit<ConsentTombstone, 'expireAt'>),
      expireAt: (data.expireAt as Timestamp).toDate(),
    }
  },

  // The tombstone lands before anything is deleted, so a failure in
  // between leaves both and a retry merges the rest in.
  retire: async (uid, key, tombstone) => {
    await tombstoneRef(key).set({
      ...tombstone,
      expireAt: Timestamp.fromDate(tombstone.expireAt),
    })
    await db().recursiveDelete(recordRef(uid))
  },
}
