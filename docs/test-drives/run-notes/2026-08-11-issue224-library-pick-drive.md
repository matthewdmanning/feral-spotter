# Test drive — #224 Library Pick Manual-time fallback

Git state: branch `issue-249-photo-library-consent` @ `46790367b583cedba295b09639db3ee4c8951e3f`. Physical Pixel 7 (`2A151FDH200HY4`).

## Setup gotchas hit this run (worth remembering for future worktree-based drives)

- This worktree checkout was missing `.env.local` and `google-services.json` — both gitignored, not copied when the worktree was created. Copied both from the main checkout (`C:/GitHub/feral-spotter`). Without `.env.local`, `EXPO_PUBLIC_AUTH_MOCK` isn't set and the app requires real Google Sign-In; without `google-services.json`, Metro logs `Could not parse Expo config: android.googleServicesFile` and the dev-launcher hangs on a blank "Tools"-only screen indefinitely.
- `adb reverse tcp:8081 tcp:8081` was missing after some point (known gotcha, see [[project_live_run_adb_reverse]]) — re-set it.
- Metro needs `CI=1` on this Windows machine (known gotcha) — started via `CI=1 npm run start -- --port 8081`.
- After any Metro restart, the Expo dev-launcher drops back to its own project-picker screen ("RECENTLY OPENED") instead of auto-loading the app — has to be manually tapped to reconnect.
- Fixture for an EXIF-less photo: `adb shell screencap -p /sdcard/Pictures/fixture_no_exif_test.png` + a `MEDIA_SCANNER_SCAN_FILE` broadcast. **Use `MSYS_NO_PATHCONV=1`** prefix on every `adb shell`/`pull` call with a `/sdcard/...` path in git-bash, not just `pull` — `screencap`'s own path arg gets mangled too without it (fails silently, prints usage text).

## #224 — inconclusive, not a clean confirm or deny

Drove: Home -> Choose from Library -> picked the EXIF-less fixture -> system Photo Picker (no separate in-app permission dialog shown — Android 13+ system picker path, consistent with #249's user story 5) -> Box Annotation (drew one box via swipe gesture, tapped Confirm, tapped Boxing Complete) -> Observed Cat form ("8 fields not set" warning, SAVE ANYWAY) -> Submission Details -> SUBMIT.

**Never saw a Manual-time date-time-picker modal appear at any point.** Submission Details displayed `8/11/2026 10:39 AM` — the wall-clock time I reached that screen, not the fixture's actual creation time (10:18 AM) and not a manual-entry prompt.

**Could not verify the persisted `metadata.time_method`, either**: `submission_cache_index`/`submission_cache_current` in `RKStorage` only ever showed one entry the whole session — a **stale `Submitted` draft from 2026-08-09** (`0040d342-...`, unrelated to this run). No new cache entry appeared for the fresh submission at any checkpoint I inspected (mid-flow, and again after tapping SUBMIT). Either the local cache write for a freshly submitted draft doesn't happen the way I expected, or something about resuming from a stale `current` pointer swallowed my new draft — genuinely don't know which from what I observed.

**Confound**: the fixture is a PNG screenshot, not a JPEG. `expo-image-picker`/the app's EXIF reader may treat a PNG's total absence of EXIF fields differently than a JPEG with EXIF present-but-no-timestamp — the domain doc's "Library pick" definition doesn't distinguish, but the underlying detection code might key off something PNG doesn't have at all (not checked this session).

**Not a bug claim** — too many open variables (stale cache pointer, PNG vs JPEG, whether Submit clears local cache on success) to call this confirmed either way. Needs either: a source read of the actual EXIF-check/manual-time-trigger code, or a cleaner re-run starting from a fully cleared cache (Settings -> clear app data, not just Reset-in-app) with a JPEG fixture that has EXIF stripped rather than a PNG that never had any.

## Follow-up: advisor-directed source read, then a real fix + clean re-run

Consulted advisor before writing any code. It correctly called out that #224 is a verification ticket with no confirmed defect, and pointed at three checks before touching code: (1) is the time display already a tap target (like location's "tap to set manually")? (2) where does `time_method`/`manual_time` actually get decided in source? (3) is the RKStorage read itself trustworthy?

**Source read result: #224's actual feature already works correctly, by design.** `src/utils/libraryPickTime.ts`'s `classifyLibraryPickTime` correctly returns `time_type: 'manual'` when any picked photo lacks EXIF `DateTime`. `src/screens/submission/create/index.tsx` renders a warning icon + tappable `DateTimePickerButton` when `time_type === 'manual' && !manual_time` — same established pattern as the location warning (explicitly commented as such in source), not an auto-popup modal. No modal auto-appearing is the design, not a bug — #224's phrasing ("the date-time-picker modal... is triggered") is a bit misleading but the underlying behavior is correct.

**Real bug found via the source read, not in #224's own description**: `submissionCache.ts` exports `clearCurrentCacheId()`, but it had zero callers anywhere in `src/`. `handleDone`'s success branch (`useSubmissionSubmit.ts`) never cleared `submission_cache_current` after a successful Submit — meaning `create/index.tsx`'s `if (!(await getCurrentCacheId())) createSubmissionCache(...)` guard never fires again after the very first submission ever made on a device. This is what made every observation in the section above impossible to trust: I was always looking at a leftover pointer from 2026-08-09, unrelated to whatever I'd just done.

**Fix shipped** (`src/hooks/useSubmissionSubmit.ts`): call `clearCurrentCacheId()` right after `updateSubmissionCache(cId, { status: 'Submitted' })` in the success branch. One line + import, matches the existing `deleteSubmissionCache`/Reset path which already did this correctly. Unit tests (`useSubmissionSubmit.cacheSync.test.ts`, `libraryPickTime.test.ts`) and `tsc --noEmit` both green.

**Clean re-run, `pm clear` first, real JPEG fixture (PIL-stripped EXIF, not a PNG screenshot)**: full flow (Home → Choose from Library → box → cat form → Submission Details) reproduced the tap-to-set time button exactly as source predicted. Tapped it, picked a date, watched the warning flip to "Date & Time Recorded". Submitted. Pulled the cache: **`time_method: "manual"`, `manual_time: "2026-08-05T06:12:00.000Z"` — exactly the date picked. #224 confirmed working, cleanly, first time.** This closes the PNG-vs-JPEG confound from the first run too — same correct behavior with a proper EXIF-less JPEG.

**The fix itself: correct by source/tests, but I couldn't cleanly re-confirm its exact live runtime behavior.** Discovered CI-mode Metro doesn't pick up source edits without a full process restart (not just an app reload) — my first post-fix run actually executed the pre-fix bundle. After restarting Metro and re-running, the final on-device state showed two separate cache entries (correct outcome — each submission got its own row instead of the original stale one) but a leftover empty-shell entry (`time_method: "device"`, `cats: []`, `updated_at === created_at`) sitting under `submission_cache_current` that I can't fully explain from source alone without adding trace logging — possibly a benign artifact of `create/index.tsx` mounting twice per pick (once pre-annotate-redirect, once after Cat Form), possibly a raw-`cat`-of-live-SQLite read artifact (the same risk advisor flagged for the original null result). Didn't keep guessing with more adb cycles once the pattern stopped converging — flagging honestly instead of overclaiming a clean live-verify.

**Net**: #224 itself — confirmed, verified, working as designed.

## Follow-up 2: traced with temporary logging, found and fixed a second bug

Added temporary `console.log` trace lines to `create/index.tsx`'s cache effect and `useSubmissionSubmit.ts`'s `handleDone`, restarted Metro (source edits need a full restart under `CI=1`, not just a reload), drove the flow again watching Metro's log directly instead of guessing from uiautomator dumps + raw SQLite pulls.

Trace showed the first fix (commit `449ad20`) firing correctly — `cleared current after submit` logged right on cue. But immediately after, the same still-mounted `create/index.tsx` effect fired _again_ (`time_type= device`, i.e. defaults) and created a brand new empty cache row, because:

- the effect's dependency array included `submission.*` fields
- `handleDone`'s `clearDraft()` resets those fields to defaults right after `clearCurrentCacheId()`, before this screen has unmounted (navigation is async)
- the re-fire saw `current` now null (just cleared) and created a stray placeholder entry

This is exactly the empty-shell entry (`time_method: "device"`, `cats: []`, `updated_at === created_at`) flagged as unexplained in Follow-up 1 — not a raw-SQLite-read artifact after all, a real ordering bug.

**Fix** (commit `0a38add`): changed the effect to mount-once (`[]` deps) — it only needs to ensure a cache row exists per screen mount, not react to every field edit.

**Re-verified clean**, `pm clear` first: full flow end to end, final on-device state is exactly one cache entry, `status: "Submitted"`, `time_method: "manual"`, and `submission_cache_current` fully absent (no orphan). Both fixes confirmed working together.

## Other observations, not directly #224 but noted live

- Box Annotation screen: tapping **Boxing Complete with zero boxes drawn** silently discards the draft and returns to Home — no confirmation dialog, no warning. Not confirmed as a bug (could be intentional "nothing to save" behavior) but worth a second look; no existing issue covers this specific case.
- Repeated `Unistyles: we detected style object with 2 unistyles styles...` warnings throughout Cat Observations screen (every field group). Not investigated further — cosmetic/perf warning, not blocking.
- `[analytics] capturer not registered` warning fired again on Submit, consistent with #197's existing documented confound (`POSTHOG_KEY` still unset here too — this doesn't newly confirm or deny #197's underlying race, same blocker as before).
