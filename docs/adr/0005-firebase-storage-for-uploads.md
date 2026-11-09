---
status: implemented — issue #266 ("Connect to storage")
---

# Firebase Storage SDK for photo uploads, not the custom `upload+api.ts` route

Issue #10 built a validation-only Expo API route (`src/app/upload+api.ts`): the client
POSTs multipart form data, the route verifies a Google ID token against a tester
allowlist, validates MIME type/size (`src/features/draft-submission/lib/upload/fileValidation.ts`), enforces a
per-submission photo count cap, then writes to GCS via `@google-cloud/storage` with
Application Default Credentials. None of this is wired to a screen yet.

Decided 2026-08-13: switch to `@react-native-firebase/storage`'s `putFile`, uploading
directly from the client to the bucket, to get resumable uploads with built-in
pause/resume/retry — the custom route's one-shot multipart POST has no resilience
story for the spotty field network conditions this app runs in. This extends the
Firebase adoption started in [ADR-0001](0001-firebase-auth-over-google-signin.md)
(Auth) to Storage.

iOS is not blocked by this choice: `@react-native-firebase/storage` wraps the native
Firebase SDKs on both platforms (Android and the Firebase Apple/Swift SDK on iOS), so
it carries forward cleanly whenever ADR-0001's "Android-only for now" restriction
lifts.

## Resolved: target bucket

Corrected 2026-08-13 — `gs://feral-segmentor-alpha` (the MVP milestone description's
bucket name) is not the target; the real bucket is `gs://feral-spotter-image-uploads`.
Confirmed via `gcloud storage buckets list --project=project-e3d5659d-bc4f-438f-88c`:
it's already linked to this Firebase project, alongside the Firebase default bucket
(`project-e3d5659d-bc4f-438f-88c.firebasestorage.app`) and an unrelated
`feral-vision-smoke` bucket. Addressed as a non-default bucket:
`getStorage(getApp(), 'gs://feral-spotter-image-uploads')`. `upload+api.ts` and
`functions/src/index.ts` both default `GCS_BUCKET_NAME` to this value now.

## Resolved: photo-count enforcement moves to a Firestore counter

Storage Rules have no primitive for counting sibling objects under a prefix —
`resource` in a `write` rule is scoped to the single object at that same path, not a
folder listing, and `request.resource` describes only the incoming write. Confirmed
against current Firebase docs (`firebase.google.com/docs/storage/security/*`), not
assumed.

Design landed 2026-08-13, scoped **per submission** (matches `MAX_PHOTOS` in
`src/shared/config/constants.ts`, not a per-user lifetime total):

- **Object path**: `submissions/{uid}/{submissionId}/{fileName}` — `uid` is the
  signed-in Firebase Auth uid directly. See the 2026-08-16 amendment below;
  this superseded an interim hashed-path design that lived here 2026-08-13
  through 2026-08-16.
- **Counter**: Firestore doc `/submissions/{submissionId}`, field `photoCount`,
  maintained by `functions/src/index.ts`'s `onSubmissionPhotoUploaded` /
  `onSubmissionPhotoDeleted` Storage triggers (Admin SDK, bypasses rules — the
  recommended path over letting the client update the counter directly).
- **Gate**: `storage.rules` uses the cross-service `firestore.get()`/`firestore.exists()`
  functions (default Firestore database only, max 2 Firestore reads per rules
  evaluation) to check `photoCount < 10` before allowing a write. The
  `firestore.exists(...) == false` branch is required — without it the _first_ photo
  of a new submission is denied, since the counter doc doesn't exist until the
  Cloud Function creates it after that first write lands.
- **Known race**: the counter increments _after_ the object finalizes, not
  synchronously with the write. Two uploads issued close enough together can both
  read `photoCount` before either increment lands, both pass the rule, and leave the
  submission at 11 photos instead of 10. The hard synchronous gate the old
  `upload+api.ts` route had (`getFiles({ prefix })` counted at request time) doesn't
  carry over exactly — this trades a strict cap for resumable uploads.
- **Firestore access**: `firestore.rules` allows the owning user read-only access to
  their submission doc; all writes are `false` (Cloud-Function-only).

Tester allowlist enforcement is still open — not addressed by this change. Custom
claims or a Firestore-backed lookup would extend the same `firestore.get()` mechanism,
but that isn't designed here.

## Amendment 2026-08-16: dropped the uid hash, raw uid in the object path

The salted-hash scheme above (`uidHash = sha256(USER_ID_HASH_SALT + uid)`,
`ownerUidHash` field) is reverted. `storage.rules`, `firestore.rules`,
`firebaseUpload.ts`, and `functions/src/index.ts` all now use the raw
Firebase Auth `uid` directly — path segment `submissions/{uid}/...`,
Firestore field `ownerUid`.

Reasoning (Matthew, 2026-08-16): a Firebase Auth uid is already an opaque,
third-party-issued identifier, not PII on its own — hashing it added no
real privacy benefit over what Firebase Auth already provides. Having the
raw uid in the object path is also useful on its own: it lets a future
"delete my data" request locate a user's objects directly, without needing
to recompute the same salt+hash the client used.

This also incidentally resolves an unverified risk the original design
carried: whether the rules language's `hashing.sha256().toHexString()`
byte-for-byte matched `expo-crypto`'s `digestStringAsync` output was never
confirmed (the rules test suite couldn't run locally at the time — JDK 17
vs. firebase-tools' JDK 21 requirement). That's moot now; there's no
cross-language hash to agree on.

## Amendment 2026-08-24: no metadata, no photo

Policy, decided alongside [#292](https://github.com/matthewdmanning/feral-spotter/issues/292):
**a photo object with no submission metadata referencing it has no reason to
exist and is deleted.** A photo uploads as soon as it is captured, before the
user has committed to submitting anything, so an abandoned or Reset draft
leaves objects in the bucket that no `metadata.json` will ever point at. Those
are the orphans this closes.

Enforcement is two-layered, because neither layer alone is sufficient:

- **Scheduled server-side sweep** — the authority. Deletes photo objects with
  no referencing metadata after a grace period. It is the only layer that
  catches a client that was killed, went offline permanently, or was
  uninstalled mid-draft.
- **Client best-effort delete on teardown** — an optimisation, not a guarantee.
  It reclaims the common case immediately instead of waiting for the sweep.

Note that `storage.rules` denies client deletes today: on a delete
`request.resource` is null, so both `isValidMetadataWrite()` and
`isValidPhotoWrite()` error and the rule fails closed. The client layer
therefore needs an explicit delete rule before it can do anything at all.

Implementation is filed as
[#293](https://github.com/matthewdmanning/feral-spotter/issues/293); the draft
teardown seam this hangs off is
[ADR-0006](0006-submission-draft-boundary.md). This closes the residual gap
this ADR left open: the bucket has a defined lifetime rule for photo objects,
not just an upload path.

## Amendment 2026-10-04: the default bucket replaces `feral-spotter-image-uploads`

This supersedes "Resolved: target bucket" above. On 2026-08-17 the app moved
to the Firebase default bucket,
`gs://project-e3d5659d-bc4f-438f-88c.firebasestorage.app`. Uploads to
`feral-spotter-image-uploads` failed with a 412 error, because that imported
bucket never got the access grant for the Firebase Storage service agent. A
default bucket needs no grant. The local `.firebaserc` rules target moved with
it.

The Storage-trigger functions kept the old bucket as their `GCS_BUCKET_NAME`
default, so they never ran for real uploads, and the counters that
`storage.rules` reads were never written
([#396](https://github.com/matthewdmanning/feral-spotter/issues/396)). The
functions default, the rules tests and `backend.md` now name the default
bucket. `BUCKET_URL` in `src/features/draft-submission/lib/upload/firebaseUpload.ts` and `BUCKET_NAME` in
`functions/src/index.ts` must stay equal.

## Amendment 2026-11-02: the photo cap is soft; the counter is idempotent

The 10-photo cap is a soft limit. `photoCount` is written by an async trigger,
so uploads that land before the counter doc exists, or inside the trigger's
latency window, all see the old count. Rules cannot count siblings
synchronously, so this is accepted rather than fixed. The hard limit is on the
client: `MAX_PHOTOS` (fixed at 10, no env override) is enforced at the camera
shutter, the camera burst loop and the library picker.

The counter itself is now exact under at-least-once, out-of-order delivery.
Each photo object has a marker doc,
`submissions/{submissionId}/photos/{encodedObjectName}`, recording the counted
generation and a tombstone for a delete that arrives first. A duplicate event,
an overwrite (new-generation finalize plus old-generation delete) and a
delete-before-finalize each move the count once at most. The delete floors at
0 and skips a colliding uid (#268). Both triggers set `retry: true`, which is
safe only because they are idempotent.

Rules changes in the same pass:

- The metadata-only patch branch requires the same size, content type and
  `md5Hash`. Size alone let a same-size overwrite with any type through.
- A photo's `customMetadata.user_id`, when present, must equal the path uid.
- An existing `metadata.json` may be rewritten at the 250-Submission cap,
  because it was counted when it first landed.

The no-metadata sweep pages its listing (1,000 objects a page) and deletes ten
objects at a time, with a 540 s timeout and 512 MiB. A prefix is still judged
only after every page is read.

## Amendment 2026-11-03: no Firestore; limits move to object names and a claim

Supersedes "Resolved: photo-count enforcement moves to a Firestore counter"
and the counter half of the 2026-11-02 amendment. Owner decision: the
project does not use Firestore at all. `firestore.rules`, the Firestore
emulator and every Firestore read and write are removed.

- **10 photos per Submission, exact.** `storage.rules` accepts a photo only
  under the names `photo-0` … `photo-9` (with an image extension). A
  Submission folder therefore cannot hold an eleventh photo, with no counter
  and no latency window, so the burst gap of the 2026-11-02 amendment is
  closed. Each photo's `upload_slot` (assigned by `usePhotoStore`, fresh
  slots before freed ones) is its name. Overwriting a slot is allowed: it
  replaces a photo rather than adding one, and Submit's `customMetadata` patch
  is such an update.
- **250 Submissions per uid, soft.** On each `metadata.json` write or delete,
  `functions/` counts the uid's `metadata.json` objects in Storage and sets
  the Auth custom claim `submissionCapReached` to match, keeping the uid's
  other claims. `storage.rules` refuses a new `metadata.json` while the claim
  is set; an existing one may always be rewritten. A client sees the claim
  after its token refreshes (at most an hour).
- The #268 submissionId collision existed only in the Firestore counter,
  which was keyed by submissionId. Storage paths include the uid, so two
  uids can no longer collide.

Existing Firestore data in the deployed project (`submissions/*`,
`submissionCounts/*`) is no longer read or written. Deleting it, and the
Firestore database, is a console step.

## Considered Options

- **Keep the custom `upload+api.ts` route** — rejected: no resumable/retry story,
  which is the reason for this change.
- **Firebase Storage SDK, direct client upload** (chosen) — resumable, works
  offline-to-online, reuses the Auth investment from ADR-0001. Trade-off: allowlist
  and count-cap enforcement need to be re-homed (see above) before this can fully
  replace the route.

## Amendment 2026-11-03: one layout contract, pinned by a test

The Submission storage layout (folder, `photo-N` names, `metadata.json`,
the caps, the cap claim name) is defined once per codebase:
`src/features/draft-submission/lib/upload/submissionLayout.ts` with `src/shared/config/submissionLimits.ts`
for the app, and `functions/src/submissionLayout.ts` for functions/.
`__tests__/rules/submissionLayout.contract.test.ts` writes every path the
app can produce against `storage.rules` in the emulator, parses it with the
functions module, and checks the shared numbers agree. A change to one copy
that the others miss fails that test instead of reaching a device.
_2026-11-01: code paths updated for the feature-folder layout ([PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)). Decision unchanged._

## Amendment 2026-11-09: organization data uses Firestore

Organization data uses Firestore. [ADR-0008](0008-firestore-for-organizations.md) governs directory records, membership, invites, permissions, and mutation receipts. Submission files, upload limits, and cap claims retain this ADR's existing design.
