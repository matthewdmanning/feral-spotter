/**
 * Maintains a per-submission photo counter in Firestore so Storage Security
 * Rules can gate uploads on it (rules can't count sibling objects directly —
 * see docs/adr/0005-firebase-storage-for-uploads.md).
 *
 * Object path convention: submissions/{uidHash}/{submissionId}/{fileName} —
 * uidHash is sha256(salt + auth uid), never the raw uid (ADR-0005).
 */
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import {
  onObjectDeleted,
  onObjectFinalized,
} from 'firebase-functions/v2/storage'

initializeApp()

const BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? 'feral-spotter-image-uploads'
const OBJECT_PATH_PATTERN = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)$/

// metadata.json (the final-submission JSON blob — see storage.rules and
// src/lib/upload/firebaseUpload.ts) lives under the same
// submissions/{uidHash}/{submissionId}/{fileName} prefix as photos but isn't
// one — it must not move the photoCount counter these triggers maintain.
const METADATA_FILE_NAME = 'metadata.json'

function parseSubmissionPath(
  objectName: string,
): { uidHash: string; submissionId: string } | null {
  const match = OBJECT_PATH_PATTERN.exec(objectName)
  if (!match) return null
  if (match[3] === METADATA_FILE_NAME) return null
  return { uidHash: match[1], submissionId: match[2] }
}

export const onSubmissionPhotoUploaded = onObjectFinalized(
  { bucket: BUCKET_NAME },
  async (event) => {
    const parsed = parseSubmissionPath(event.data.name)
    if (!parsed) return

    const firestore = getFirestore()
    const doc = firestore.collection('submissions').doc(parsed.submissionId)

    // #268: submissionId is client-generated, so two different uids can
    // collide on the same id. The Storage write already landed by the time
    // this trigger runs — it can't retroactively deny it — but it must not
    // flip ownerUidHash or inflate another uid's photoCount. Transaction
    // guards against a same-id race between two first-writers; the loser
    // simply doesn't get counted.
    await firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(doc)
      const existingOwner = snapshot.get('ownerUidHash') as string | undefined

      if (existingOwner != null && existingOwner !== parsed.uidHash) return

      tx.set(
        doc,
        { ownerUidHash: parsed.uidHash, photoCount: FieldValue.increment(1) },
        { merge: true },
      )
    })
  },
)

export const onSubmissionPhotoDeleted = onObjectDeleted(
  { bucket: BUCKET_NAME },
  async (event) => {
    const parsed = parseSubmissionPath(event.data.name)
    if (!parsed) return

    // ponytail: decrement can't go below 0 if a doc is ever cleared out of
    // band; add a floor if that happens in practice.
    await getFirestore()
      .collection('submissions')
      .doc(parsed.submissionId)
      .set({ photoCount: FieldValue.increment(-1) }, { merge: true })
  },
)
