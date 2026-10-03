# 2026-08-25 — Post-#292 device drive (Pixel 7)

**Git state:** `issue-299-remove-this-cat` @ `c29f902c80641fbc57b76b445cb637bc584be391`
**Working tree: dirty** — driven as-is, at Matthew's instruction. Uncommitted
#299 work included in the bundle: `CatForm.tsx`/`.styles.ts`,
`useSubmissionStore.ts`, `submission/cats/index.tsx`,
`submission/create/index.tsx`/`.styles.ts`, plus untracked
`src/hooks/useRemoveCat.ts` and its test.

**Device:** Pixel 7 physical, `2A151FDH200HY4`, arm64-v8a, Android 17.
**Backend mode:** `[firebase] mode: live` (confirmed in Metro client log).
`EXPO_PUBLIC_AUTH_MOCK=false`, no `EXPO_PUBLIC_USE_FIREBASE_EMULATOR`.
This deviates from the documented emulator-suite default deliberately —
verifying the renewed Firebase key requires live Auth.

## Status: drive completed

The auth gate blocked this drive for most of the session. Root cause was a
wrong API key in `google-services.json`; once swapped and rebuilt,
sign-in passed and all three scenarios ran.

| Scenario                                       | Result                        |
| ---------------------------------------------- | ----------------------------- |
| 1. Reset mid-pass, then new draft (#292)       | **PASS**                      |
| 2. Leave-confirm, three exits (#305)           | **PASS**                      |
| 3. Google Sign-In vs the renewed key           | **PASS** (after the key swap) |
| Bonus: #299 remove-a-cat, both call sites      | **PASS**                      |
| Bonus: Settings, Clear Draft with a draft live | **FAIL** — see Defects        |

### Passed

- **Google Sign-In** — `/sign-in -> /analytics-consent`, no `[sign-in] google
failed`, against `[firebase] mode: live`.
- **#305 unsaved cat** — hardware back, header arrow and swipe-back all prompt.
- **#305 saved cat** — editing a saved cat and leaving does _not_ prompt.
- **#292 reset** — after Reset, Home drops "Continue Observation"; a fresh
  draft shows `1 / 1` photos, clean crop frame, no carried boxes or cat id.
- **#299 Cat Form** — "Remove this Cat" shows only for a saved cat, prompts,
  removes.
- **#299 Cat List row** — trash prompts without also opening the cat for edit
  (nested `Pressable` behaves).
- **#299 empty state** — both removal paths land on the annotate-or-describe
  choice, no forced redirect. Replaces a blank screen (`return null`).
- **"Describe a Cat"** — opens Cat Form directly; save label correctly reads
  "Save Observation" rather than "Put the Cat in a Box" when the cat has no
  boxes.
- **First-pass auto-skip preserved** — zero cats on arrival still routes
  `/submission/create -> /submission/annotate`.
- **Location capture** — `[location] consent hydrated: true`, `OS location
services enabled: true`, `watchPositionAsync resolved, subscription live`.
- **Abandon pass with zero cats** — lands Home, no redirect loop.
- Zero `ERROR` lines in the Metro log across the whole session.

### Not exercised

- Removal with **two or more cats** present — every removal ran against a
  single cat, so "your other cats are not affected" is covered by unit tests
  only, not on device.
- **Submit end-to-end** — Finished! was never pressed, so no upload or Storage
  write happened.

### PostHog consent gating — not re-tested here, and does not need to be

This drive declined analytics and saw no `posthog`/`[analytics]` lines, which
on its own proves little (absence is consistent with "suppressed" and with
"nothing fired anyway"). It does not need re-deriving: registration was
confirmed against the PostHog portal and the gating issues are closed — #13
(implement), #197 (events firing then dropping), #85 (SDK running without the
analytics-specific opt-in) and #69 (users must be able to opt out). Settings
carries no analytics toggle, so any future re-test needs a reinstall.

## Defects found

### Clear Draft leaves a phantom draft behind (new, on `main`)

Settings -> Draft -> **Clear Draft**, with a draft in progress:

- The confirm copy and the "Submission cleared" alert are correct, and it
  routes Home as #292 intended.
- But Home **still offers "Continue Observation"**.
- Tapping that walks `/ -> /submission/create -> /submission/annotate` and
  dead-ends on **"No photos to review."**

**Reset does not have this bug** — after Reset, Home drops the Continue
Observation entry entirely. So the two teardown callers disagree about what
"cleared" means, which is the exact class of drift ADR-0006 and #292's
single-owner seam exist to prevent. Clear Draft is that seam's third caller
(added in PR #303).

Not related to the #299 work in this tree; reproduces on merged `main` code.

## Scenario 3: Google Sign-In fails, then passes after a key swap

Walked intro → consent → camera + precise-location grants → sign-in →
Google account picker → selected the test account. The picker rendered
correctly, titled "to continue to feral-spotter", so the OAuth client
registration and debug-keystore SHA-1 are valid and the request reached
Firebase. Sign-in then failed:

```
[sign-in] google failed: [Error: [auth/unknown] An internal error has occurred.]
  at signInWithProvider (src/lib/auth/firebaseAuthProvider.ts:89:50)
```

Surfaced as the generic `Sign-in failed / Something went wrong signing in`
alert plus a LogBox console error on device. `src/lib/auth` swallows the
underlying cause into `console.error`, so the alert gives a user nothing to
act on — worth improving separately.

Root cause was a Google Cloud API-key misconfiguration, not app code and not
the 2026-08-22 key expiry. Swapping in a correctly-scoped key and rebuilding
made sign-in pass, and the remaining scenarios then ran normally.

Which key, which APIs, and how it was diagnosed are recorded in
`.agents/secrets.md` — gitignored, and deliberately kept out of this public
repo.

## Environment findings (independent of the above)

**`:app:packageDebug` is flaky, not broken.** First emulator build failed at
`PackageAndroidArtifact$IncrementalSplitterRunnable` with no root cause
printed; re-running the identical command with zero changes succeeded
(`BUILD SUCCESSFUL in 50s`). Consistent with a Windows file-lock during
incremental APK writes. **Do not reach for `expo prebuild --clean` for this**
— see below.

**`prebuild --clean` is expensive here and was avoided.** `/android` is
gitignored (`.gitignore:24`), so it has no git history to restore from, and it
holds two hand-made things that do not regenerate:

- `org.gradle.workers.max=6` in `android/gradle.properties` — there is **no
  `expo-build-properties` plugin** in `app.json` to re-emit it, so a clean
  reintroduces the 2026-08-21 Kotlin-daemon crash.
- `android/app/debug.keystore` — regenerating it produces a new SHA-1, which
  would break the very Google Sign-In path under test. The registered SHA-1 is
  recorded in `.agents/secrets.md`.

Both were backed up to the session scratchpad before any build ran.

**`expo run:android` picks the LAN URL and `preandroid` destroys the tunnel.**
The build opened
`exp+feral-spotter://expo-development-client/?url=http%3A%2F%2F172.20.3.17%3A8081`
and the dev client landed on `DevLauncherErrorActivity`. `preandroid` is
`adb kill-server && adb start-server && pm clear`, which wipes every
`adb reverse` tunnel on each run — so the standard workflow hands you a dev
client pointed at a LAN address with no tunnel. `adb reverse tcp:8081 tcp:8081`
plus relaunching on `localhost` fixed it immediately: same build, same Metro,
only the URL changed.

## Bearing on #309 (blank screen / "Metro dies mid-session")

#309 did **not** reproduce. Metro stayed up throughout (`/status` 200), and the
app rendered on both emulator and device.

- **The `/index.bundle` 404 in #309 is a red herring.** Reproduced it here in
  0.47s — not 50s — while Metro was healthy. Body: `Unable to resolve module
./index`. `package.json:3` is `"main": "expo-router/entry"`; there is no root
  `index.js`. The real entry,
  `/node_modules/expo-router/entry.bundle?platform=android&dev=true`, returns
  **200, 7.1 MB, 38s cold**. The issue was probing a path this app never had.
- **A LAN-unreachable dev client explains #309's whole symptom set** without
  Metro having died — including the launcher's empty "Development servers"
  list, which is what failed LAN autodiscovery looks like.
- **Metro's cache was corrupt on startup:** `Error while reading cache, falling
back to a full crawl: Error: Unable to deserialize cloned data.` That full
  crawl is why the cold bundle took 38s — against #309's 50s-timeout curl this
  reads as a hang.
- **#309's "empty view tree" evidence may be an artifact.** In git-bash,
  `adb shell uiautomator dump /sdcard/ui.xml` silently becomes
  `C:/Program Files/Git/sdcard/ui.xml` — it prints a success line and writes
  nothing, yielding a false "0 nodes, blank screen". This bit this session too.
  `docs/agents/test-driving.md` already documents the `MSYS_NO_PATHCONV=1` fix,
  which suggests the 08-24 session did not apply it.

Not proof of what happened on 08-24 — that session's Metro output was lost to
`tail` buffering, as #309 itself notes — but a concrete, reproducible cause
where there was none.

## Not yet checked (deferred with the blocked scenarios)

Per this doc's "Every emulator run" requirements: PostHog consent gating and
`[location]`/GPS capture. Neither is reachable until sign-in succeeds. No
analytics-consent control appeared in the intro/consent flow — it may live in
Settings; worth confirming when the drive resumes.

## Logs

Session logs in the session scratchpad (not committed): `drive-logcat.log`
(full unfiltered logcat), `device-build.log` (build + Metro stdout, contains
the sign-in stack trace), `native-build.log`, `metro.log`.

