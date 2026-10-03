# Run notes: upload check after storage-rules deploy confirmation

Git state: `issue-279-firebase-emulator-wiring` @ `92d59e899c5e966ce892c74f033b05239a5f793f`.
Device: Pixel 7 physical (`2A151FDH200HY4`), `EXPO_PUBLIC_AUTH_MOCK=false` (real auth), live Firebase (no `USE_FIREBASE_EMULATOR`).

## Pre-check: storage.rules deploy state

Verified via Firebase Rules API (`GET .../releases`, then diffed the live
ruleset's `source.files[0].content` against local `storage.rules` in
Python, byte-for-byte): `firebase.storage/project-e3d5659d-bc4f-438f-88c.firebasestorage.app`
(the default bucket, matching `.firebaserc`'s current `feral-uploads`
target) is deployed and **identical** to local `storage.rules`. The pending
deploy from the 2026-08-17 status-inbox entry has landed.

## Result: upload still fails, but with a different symptom than before

Drove the app via `adb` (New Sighting → discarded a stale draft → annotated
2 existing pooled photos with default Unknown/Unsure attributes → Submit).
Outcome: **"Submission Failed — Photo upload is taking longer than expected.
Check your connection and try again."** — this is `useSubmissionSubmit.ts`'s
30-second `waitForUploads` timeout firing, not an immediate error.

**Not the same failure as the prior `[storage/unknown]` 412 permissions
error** (2026-08-17-photo-upload-retest.md) — no `StorageException`, no HTTP
result code, no Firebase/OkHttp log line of any kind appeared in
`adb logcat --pid=<app pid>` for the entire submit attempt. The absence of
any native network-layer log entry, for either success or failure, is
itself the notable finding — it suggests the upload call may not be
reaching the network layer at all, not that it reached it and got denied.

**Caveat — Metro's dev-socket looked dead for this whole session**:
`.expo/dev/logs/start.log`'s last entry before my test was a
`[timeout] connection terminated with Device ... after not responding for
60 seconds` (~10 min before this test), and zero `metro:client_log` entries
appeared for the entire drive despite normal JS-driven navigation working
throughout (cat form, box annotation, submission details all rendered and
responded correctly). This shouldn't affect native module calls
(`@react-native-firebase/storage` doesn't route through Metro to execute),
but it means any `console.error` the JS layer fired is invisible in this
run — only native-layer logs were checked.

**Not a clean repro** — reused 2 photos from a pre-existing draft
(discard-via-New-Sighting either didn't clear the pool or I mis-navigated;
didn't confirm which) rather than a fresh camera capture. Worth a clean
retest with a freshly captured photo before treating "upload still fails"
as conclusive.

## Clean retest: same failure, fresh capture

Reset the draft entirely (Home showed no "Continue Observation" after
Reset, confirming the pool was actually empty), captured a brand-new photo
via the live camera shutter, annotated it with a real drag-drawn box,
saved the cat with defaults, submitted "1 cat and 1 photo?".

Same result: **"Submission Failed — Photo upload is taking longer than
expected."** ~31s between the submit tap and the failure dialog appearing
(matches `useSubmissionSubmit.ts`'s 30s `waitForUploads` timeout). Again
zero native Firebase/OkHttp/network log lines for the entire window — not a
stale-draft artifact, reproduces clean.

Two clean reproductions with identical symptom + identical logging silence
is a strong signal the failure is upstream of the network call (something
in the JS layer never reaches `putFile`, or reaches it but the native SDK
never logs an attempt) — not a rules/permissions denial, which would log a
`StorageException` like the 2026-08-17 retest note's 412 did.

**Next diagnostic step, not done this session**: Metro's dev-socket was
dead for the whole session (see above) — no `console.error` a JS catch
block might fire is visible while it's down. Restarting Metro / reloading
the app's JS bundle should restore the relay and surface whatever
`firebaseUpload.ts` is actually throwing, which would resolve this faster
than more native-logcat-only attempts.

## Not checked

- Whether the photos were ever queued for upload at capture time (didn't
  inspect `usePhotoStore` state or check for an in-flight upload before
  hitting Submit).
- PostHog consent-off gate, location capture — out of scope for this
  narrowly-scoped upload check.

## Raw logs

`/tmp/upload-test-logcat.log` (pid-scoped logcat, not saved to repo —
16 lines total, no Firebase/network activity; copy into
`docs/test-drives/logs/` if this needs to be preserved).
