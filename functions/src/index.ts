/**
 * Maintains per-submission and per-uid Firestore counters so Storage
 * Security Rules can gate uploads on them (rules can't count sibling
 * objects directly — see docs/adr/0005-firebase-storage-for-uploads.md),
 * and gates sign-in on the tester allowlist via a custom claim (#267).
 *
 * Object path convention: submissions/{uid}/{submissionId}/{fileName} —
 * uid is the signed-in Firebase Auth uid directly (previously a salted
 * hash; dropped 2026-08-15, see storage.rules).
 */
import { getAuth } from 'firebase-admin/auth'
import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import type { AuthBlockingEvent } from 'firebase-functions/v2/identity'
import { beforeUserSignedIn } from 'firebase-functions/v2/identity'
import {
  onObjectDeleted,
  onObjectFinalized,
} from 'firebase-functions/v2/storage'

initializeApp()

const BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? 'feral-spotter-image-uploads'
const OBJECT_PATH_PATTERN = /^submissions\/([^/]+)\/([^/]+)\/([^/]+)$/
const METADATA_PATH_PATTERN = /^submissions\/([^/]+)\/([^/]+)\/metadata\.json$/

// metadata.json (the final-submission JSON blob — see storage.rules and
// src/lib/upload/firebaseUpload.ts) lives under the same
// submissions/{uid}/{submissionId}/{fileName} prefix as photos but isn't
// one — it must not move the photoCount counter these triggers maintain.
const METADATA_FILE_NAME = 'metadata.json'

// #293 ("no metadata ⇒ no photo"). A photo with no location, time or
// annotation is useless to the wider project, so if the metadata never
// arrived the image must go too.
//
// Retention window before an unsubmitted prefix is swept. 7 days: long
// enough that a user who abandons a draft on Monday and resumes midweek
// keeps their photos, short enough that abandoned uploads don't accumulate
// indefinitely. Product decision, 2026-08-24.
const SWEEP_RETENTION_DAYS = 7

function parseSubmissionPath(
  objectName: string,
): { uid: string; submissionId: string } | null {
  const match = OBJECT_PATH_PATTERN.exec(objectName)
  if (!match) return null
  if (match[3] === METADATA_FILE_NAME) return null
  return { uid: match[1], submissionId: match[2] }
}

// Sole parser for the tester allowlist. The client-side twin it used to
// mirror (src/lib/upload/allowlist.ts) was deleted in ed2cdb4.
function parseTesterAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
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
    // flip ownerUid or inflate another uid's photoCount. Transaction guards
    // against a same-id race between two first-writers; the loser simply
    // doesn't get counted.
    await firestore.runTransaction(async (tx) => {
      const snapshot = await tx.get(doc)
      const existingOwner = snapshot.get('ownerUid') as string | undefined

      if (existingOwner != null && existingOwner !== parsed.uid) return

      tx.set(
        doc,
        { ownerUid: parsed.uid, photoCount: FieldValue.increment(1) },
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

// #270: counts distinct submissions per uid so storage.rules can cap
// them (isValidMetadataWrite — checked at metadata.json write, not per
// photo, because isValidPhotoWrite already spends the rules' 2-Firestore-
// read budget on the photoCount check; metadata.json's own rule evaluation
// starts fresh with its own budget). Caps submissions that reach Submit,
// not photos uploaded into an abandoned draft — see the amendment to
// ADR-0005 for the residual gap that leaves open.
export const onSubmissionSubmitted = onObjectFinalized(
  { bucket: BUCKET_NAME },
  async (event) => {
    const match = METADATA_PATH_PATTERN.exec(event.data.name)
    if (!match) return
    const [, uid, submissionId] = match

    const firestore = getFirestore()
    const counterDoc = firestore.collection('submissionCounts').doc(uid)
    const marker = counterDoc.collection('items').doc(submissionId)

    // metadata.json can be re-uploaded on retry (isValidMetadataWrite has
    // no create-only restriction) — dedupe via a per-submission marker so
    // a retry doesn't double-count against the cap.
    await firestore.runTransaction(async (tx) => {
      const markerSnapshot = await tx.get(marker)
      if (markerSnapshot.exists) return

      tx.set(marker, {})
      tx.set(counterDoc, { count: FieldValue.increment(1) }, { merge: true })
    })
  },
)

// #267: gates sign-in on the tester allowlist by setting a custom claim
// (request.auth.token.allowedTester), checked in storage.rules' allow
// write. Runs on every sign-in (not just account creation) so an
// already-registered tester's very next sign-in picks up the claim —
// no separate backfill script needed. Requires Identity Platform to be
// enabled for this project (Firebase console > Authentication > Settings);
// blocking functions don't run without it, which means uploads are denied
// for everyone until it's enabled and each tester has signed in at least
// once post-deploy. See the PR notes for deploy sequencing.
// Exported separately from the beforeUserSignedIn wrapper below: the SDK's
// BlockingFunction type is an Express (req, resp) handler, not something
// that takes an AuthBlockingEvent directly, so this is the piece tests can
// actually call.
export async function resolveTesterClaim(
  event: AuthBlockingEvent,
): Promise<void> {
  const email = event.data?.email?.toLowerCase()
  const allowlist = parseTesterAllowlist(process.env.TESTER_ALLOWLIST_EMAILS)
  const allowedTester = email != null && allowlist.has(email)

  const uid = event.data?.uid
  if (!uid) return
  if (event.data?.customClaims?.allowedTester === allowedTester) return

  await getAuth().setCustomUserClaims(uid, {
    ...event.data?.customClaims,
    allowedTester,
  })
}

export const gateTesterAllowlist = beforeUserSignedIn(resolveTesterClaim)

// #293: the server half of "no metadata ⇒ no photo".
//
// Photos upload fire-and-forget at capture (uploadNewPhoto → putFile), not
// at Submit, so every uploaded photo is already in
// submissions/{uid}/{submissionId}/ whether or not the user ever submits.
// Only Submit writes metadata.json. An abandoned or Reset draft therefore
// strands bare images with no location, time or per-image customMetadata.
//
// discardDraft() makes a best-effort client delete, but it cannot honor the
// policy alone: Reset while offline, a force-quit mid-draft, or a user who
// simply walks away never issues the delete — and those are exactly the
// drafts that strand photos. This sweep is the backstop.
//
// Runs under the Admin SDK, which bypasses Security Rules entirely, so it
// is unaffected by storage.rules' delete branch.
//
// Deleting each object individually (rather than a bulk prefix delete) is
// deliberate: it fires onSubmissionPhotoDeleted per object, which keeps
// photoCount consistent instead of stranding a counter doc at a count the
// bucket no longer backs.
export const sweepPhotosWithoutMetadata = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'Etc/UTC' },
  async () => {
    const bucket = getStorage().bucket(BUCKET_NAME)
    const cutoff = Date.now() - SWEEP_RETENTION_DAYS * 24 * 60 * 60 * 1000

    const [files] = await bucket.getFiles({ prefix: 'submissions/' })

    // Group by submissions/{uid}/{submissionId}/ prefix. A prefix is swept
    // only when it has no metadata.json AND every object in it predates the
    // cutoff — a prefix still being actively uploaded into must survive.
    const prefixes = new Map<
      string,
      { hasMetadata: boolean; newestMs: number; names: string[] }
    >()

    for (const file of files) {
      const match = OBJECT_PATH_PATTERN.exec(file.name)
      if (!match) continue
      const prefix = `submissions/${match[1]}/${match[2]}/`

      const entry = prefixes.get(prefix) ?? {
        hasMetadata: false,
        newestMs: 0,
        names: [],
      }
      if (match[3] === METADATA_FILE_NAME) entry.hasMetadata = true
      // updated/timeCreated are ISO strings on the metadata payload; a
      // missing value must not read as "ancient" and trigger a delete, so
      // it falls back to now.
      const updated = file.metadata?.updated ?? file.metadata?.timeCreated
      const updatedMs = updated ? Date.parse(String(updated)) : Date.now()
      entry.newestMs = Math.max(
        entry.newestMs,
        Number.isNaN(updatedMs) ? Date.now() : updatedMs,
      )
      entry.names.push(file.name)
      prefixes.set(prefix, entry)
    }

    for (const [prefix, entry] of prefixes) {
      if (entry.hasMetadata) continue
      if (entry.newestMs >= cutoff) continue

      for (const name of entry.names) {
        // One failure must not abandon the rest of the sweep.
        try {
          await bucket.file(name).delete()
        } catch (error) {
          console.error(`[sweep] failed to delete ${name}`, error)
        }
      }
      console.log(
        `[sweep] deleted ${entry.names.length} object(s) under ${prefix} (no metadata.json, older than ${SWEEP_RETENTION_DAYS}d)`,
      )
    }
  },
)
