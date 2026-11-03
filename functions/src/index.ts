/**
 * Storage-side upkeep with no database: keeps the per-uid Submission cap
 * claim in step with the uid's metadata.json objects (#270), sweeps photos
 * that never got metadata (#293), sets the tester-allowlist claim (#267)
 * and syncs the email list. See docs/adr/0005-firebase-storage-for-uploads.md.
 *
 * Object path convention: submissions/{uid}/{submissionId}/{fileName} —
 * uid is the signed-in Firebase Auth uid directly (previously a salted
 * hash; dropped 2026-08-15, see storage.rules).
 */
import { getAuth } from 'firebase-admin/auth'
import { initializeApp } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { createEmailListProvider, DEFAULT_EMAIL_PROVIDER } from './email'
import { setEmailSubscription } from './email/setEmailSubscription'
import {
  MAX_SUBMISSIONS_PER_UID,
  METADATA_FILE_NAME,
  SUBMISSION_CAP_CLAIM,
  SUBMISSIONS_ROOT,
  parseSubmissionObject,
  submissionPrefix,
  userPrefix,
} from './submissionLayout'
import { defineSecret, defineString } from 'firebase-functions/params'
import { onRequest } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import type { AuthBlockingEvent } from 'firebase-functions/v2/identity'
import { beforeUserSignedIn } from 'firebase-functions/v2/identity'
import {
  onObjectDeleted,
  onObjectFinalized,
} from 'firebase-functions/v2/storage'

initializeApp()

// Must match BUCKET_URL in src/lib/upload/firebaseUpload.ts (ADR-0005).
const BUCKET_NAME =
  process.env.GCS_BUCKET_NAME ??
  'project-e3d5659d-bc4f-438f-88c.firebasestorage.app'

// #293 ("no metadata ⇒ no photo"). A photo with no location, time or
// annotation is useless to the wider project, so if the metadata never
// arrived the image must go too.
//
// Retention window before an unsubmitted prefix is swept. 7 days: long
// enough that a user who abandons a draft on Monday and resumes midweek
// keeps their photos, short enough that abandoned uploads don't accumulate
// indefinitely. Product decision, 2026-08-24.
const SWEEP_RETENTION_DAYS = 7

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

// #270, without Firestore: caps distinct Submissions per uid. The count is
// the uid's metadata.json objects in Storage, the same thing a Submission
// is. Rules cannot count objects, so this keeps an Auth custom claim in
// step with the count, and storage.rules refuses a new metadata.json
// while the claim is set. Recounted on every metadata.json write and
// delete, so it is idempotent under at-least-once delivery and clears
// itself once Submissions are deleted.
//
// Soft at the edge: a client's token carries the claim only after it
// refreshes (at most an hour). The 10-photo cap needs no such step: it is
// enforced by object name in storage.rules.
export { MAX_SUBMISSIONS_PER_UID, SUBMISSION_CAP_CLAIM }

export async function syncSubmissionCapClaim(uid: string): Promise<void> {
  const [files] = await getStorage()
    .bucket(BUCKET_NAME)
    .getFiles({
      prefix: userPrefix(uid),
      matchGlob: `**/${METADATA_FILE_NAME}`,
    })
  const capReached = files.length >= MAX_SUBMISSIONS_PER_UID

  const user = await getAuth().getUser(uid)
  const claims = user.customClaims ?? {}
  if (Boolean(claims[SUBMISSION_CAP_CLAIM]) === capReached) return
  await getAuth().setCustomUserClaims(uid, {
    ...claims,
    [SUBMISSION_CAP_CLAIM]: capReached,
  })
}

async function syncCapForObject(name: string): Promise<void> {
  const object = parseSubmissionObject(name)
  if (!object?.isMetadata) return
  try {
    await syncSubmissionCapClaim(object.uid)
  } catch (error) {
    // A deleted account has nothing left to cap.
    if ((error as { code?: string }).code === 'auth/user-not-found') return
    throw error
  }
}

export const onSubmissionSubmitted = onObjectFinalized(
  { bucket: BUCKET_NAME, retry: true },
  (event) => syncCapForObject(event.data.name),
)

export const onSubmissionDeleted = onObjectDeleted(
  { bucket: BUCKET_NAME, retry: true },
  (event) => syncCapForObject(event.data.name),
)

// #267: sets the tester-allowlist custom claim
// (request.auth.token.allowedTester) on every sign-in. storage.rules does
// not check it yet: enforcement is deferred while it is dev friction, so
// any signed-in user can upload today. Runs on every sign-in (not just
// account creation) so a registered tester's claim is current once
// enforcement lands. Requires Identity Platform (Firebase console >
// Authentication > Settings); blocking functions don't run without it.
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
// The default 60 s would cut a large sweep off silently, and the next run
// would repeat the same listing. Listing is paged so the whole bucket's
// metadata is never held at once; deletes run a few at a time.
const SWEEP_PAGE_SIZE = 1000
const SWEEP_DELETE_CONCURRENCY = 10

export const sweepPhotosWithoutMetadata = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'Etc/UTC',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    const bucket = getStorage().bucket(BUCKET_NAME)
    const cutoff = Date.now() - SWEEP_RETENTION_DAYS * 24 * 60 * 60 * 1000

    // Group by submissions/{uid}/{submissionId}/ prefix. A prefix is swept
    // only when it has no metadata.json AND every object in it predates the
    // cutoff — a prefix still being actively uploaded into must survive.
    const prefixes = new Map<
      string,
      { hasMetadata: boolean; newestMs: number; names: string[] }
    >()

    let pageToken: string | undefined
    do {
      const [files, nextQuery] = await bucket.getFiles({
        prefix: SUBMISSIONS_ROOT,
        autoPaginate: false,
        maxResults: SWEEP_PAGE_SIZE,
        pageToken,
      })
      pageToken = (nextQuery as { pageToken?: string } | undefined)?.pageToken
      for (const file of files) {
        const object = parseSubmissionObject(file.name)
        if (!object) continue
        const prefix = submissionPrefix(object.uid, object.submissionId)

        const entry = prefixes.get(prefix) ?? {
          hasMetadata: false,
          newestMs: 0,
          names: [],
        }
        if (object.isMetadata) entry.hasMetadata = true
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
    } while (pageToken)

    const doomed: string[] = []
    for (const [prefix, entry] of prefixes) {
      if (entry.hasMetadata) continue
      if (entry.newestMs >= cutoff) continue
      doomed.push(...entry.names)
      console.log(
        `[sweep] deleting ${entry.names.length} object(s) under ${prefix} (no metadata.json, older than ${SWEEP_RETENTION_DAYS}d)`,
      )
    }

    let next = 0
    const worker = async () => {
      while (next < doomed.length) {
        const name = doomed[next++]
        // One failure must not abandon the rest of the sweep.
        try {
          await bucket.file(name).delete()
        } catch (error) {
          console.error(`[sweep] failed to delete ${name}`, error)
        }
      }
    }
    await Promise.all(
      Array.from({ length: SWEEP_DELETE_CONCURRENCY }, () => worker()),
    )
  },
)

const EMAIL_PROVIDER = defineString('EMAIL_PROVIDER', {
  default: DEFAULT_EMAIL_PROVIDER,
})
const EMAIL_LIST_ID = defineString('EMAIL_LIST_ID')
const EMAIL_API_KEY = defineSecret('EMAIL_API_KEY')

// Opt-in/out for email updates. The mailing-list service's API key stays
// here; the app only sends its own Firebase ID token. See ADR-0007.
export const syncEmailSubscription = onRequest(
  { secrets: [EMAIL_API_KEY] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).end()
      return
    }
    try {
      const provider = createEmailListProvider(EMAIL_PROVIDER.value(), {
        apiKey: EMAIL_API_KEY.value(),
        listId: EMAIL_LIST_ID.value(),
      })
      const { status } = await setEmailSubscription(
        { authorization: req.header('authorization'), body: req.body },
        provider,
        (token) => getAuth().verifyIdToken(token),
      )
      res.status(status).end()
    } catch (error) {
      console.error('[email] subscription sync failed', error)
      res.status(502).end()
    }
  },
)
