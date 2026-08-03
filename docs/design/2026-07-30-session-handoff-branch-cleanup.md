# Session handoff (2026-07-30) — branch unbundling, PR revivals, location-services update

Working file — do **not** commit (per handoff/reference convention).

## TL;DR

Started from a bloated `issue-7-firebase-auth-migration` working tree. Unbundled
it, then audited every stray branch: revived the still-valuable ones as focused
PRs (all merged), abandoned the superseded/obsolete ones (archived as tags), and
brought the one active feature branch (`issue-47`) up to date. **Six PRs merged
to main this session.** One feature branch (`issue-47-location-services`) is
updated but intentionally not landed — it needs one more merge + a runtime drive.

## Main state

- `main` tip: **`e782f38`** — `feat(camera): discard captured photos (#113)`.
- Landed this session (all merged): **#108, #109, #111, #112, #113** (plus #107
  auth umbrella + #110 workflow, merged around session start).

## PRs opened this session

| PR   | Title                                                      | Source                | State      |
| ---- | ---------------------------------------------------------- | --------------------- | ---------- |
| #108 | `test:` expand HomeScreen gate model to UX journeys        | issue-7 stray commit  | **merged** |
| #109 | `chore:` glossary/docs/boilerplate housekeeping            | issue-7 stray commits | **merged** |
| #111 | `feat(analytics):` PostHog crash reporting + camera funnel | revived `issue-13`    | **merged** |
| #112 | `fix(camera):` restore exit + close on camera screen       | revived `issue-32`    | **merged** |
| #113 | `feat(camera):` discard captured photos from carousel      | revived `issue-32`    | **merged** |

All used "Refs #N (closed)" (no re-close, no new issue) per instruction.

## Origin: the issue-7 unbundling

`issue-7-firebase-auth-migration` was an **umbrella** branch that had already
merged to main via **PR #107** (closed #7, #93, #65). Its local tree still
carried **7 post-merge stray commits** spanning unrelated concerns. Split them:

- gate-model test → **#108**; glossary/docs/boilerplate → **#109**.
- The repo-wide prettier "format sweep" was **dropped** in favour of per-branch
  gradual-prettier (pre-push hook formats a branch's changed files and blocks
  the push until committed).
- `issue-7` branch **deleted** (local + remote); backup deleted.

## Branch usefulness decisions

| Branch                           | Issue                        | Verdict                                                                             | Action                                                                                                                        |
| -------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `issue-13-posthog-analytics`     | #13 closed                   | real orphaned work                                                                  | **revived → #111 (merged)**; local branch + `backup/posthog-pre-merge` now deletable                                          |
| `issue-32-camera-screen-fixes`   | #32 closed, bug live on main | still valid                                                                         | **revived → #112 + #113 (merged)**; insets superseded/dropped; branch **deleted**, tag `archive/issue-32-camera-screen-fixes` |
| `issue-41-contextual-repriming`  | #41 closed                   | **superseded** by main's react-native-permissions + expo-asset path (would regress) | **abandoned**; deleted, tag `archive/contextual-repriming-41`                                                                 |
| `issue-47-location-services`     | #47 **open**                 | active complete feature                                                             | **updated onto main, NOT landed** — see below                                                                                 |
| `no-nitro`                       | —                            | merged into main                                                                    | **deleted** (worktree + local + remote)                                                                                       |
| `photo-screen-flow`              | —                            | stale, unmerged                                                                     | **deleted** (local backup + remote), tags `archive/photo-screen-flow-{remote,backup}`                                         |
| `origin/matthewdmanning/issue12` | #12 closed                   | merged (ahead 0)                                                                    | safe to delete remote — **not done**                                                                                          |

Not investigated in depth (left as-is): `issue-54` (#54 closed, 1 commit),
`issue-63` (#63 **open**, active), `issue-30`, `issue-38`, `issue-67`,
`issue-14`/`issue-17` (checked-out worktrees), `alpha`.

## In-flight: `issue-47-location-services` (#47 + #102)

Complete implementation (one Live fix per Submission per ADR 0002 + native
`expo-maps` map picker; xstate flow-model tests; ADR 0002). Runtime behavioral
drive had been blocked on #7 — **now unblocked** (#7 merged).

**Done this session:** merged `main` (as of #111) into the branch —
commit **`ad39790`**, pushed. Conflict resolutions:

- `useCameraCapture` / `useCatSubmit`: kept **ADR 0002** (one Submission
  location, no per-photo GPS) over main's per-photo EXIF path; retained main's
  PostHog capture events + `Asset.create` device-save.
- `app.json`: unioned plugins (`expo-maps` + `expo-apple-authentication` +
  fbsdk); took main's `googleServicesFile`.
- `CONTEXT.md`: unioned glossary (location terms + onboarding/auth terms).
- `package.json`: kept `expo-maps` / `xstate` / `@xstate/graph` + main's deps;
  lockfile regenerated via `npm install --legacy-peer-deps` (#17 peer conflict).
- Gates green at `ad39790`: `tsc` 0, **64** jest tests, `expo lint` 0 errors,
  prettier clean.

**OUTSTANDING (do these before a PR):**

1. **Re-merge current `main`** — main advanced to `e782f38` (#112/#113 camera
   work) _after_ `ad39790`. Those touch `useCameraCapture` again (topBar,
   GestureHandlerRootView, discard), so expect another conflict pass on that
   file. issue-47's location merge must be re-reconciled with the discard +
   exit/close changes.
2. **Runtime behavioral drive** — create→device→cats; pin→picker. Needs the app
   actually run (device GPS + native map); now possible since #7 landed.
3. **Open the PR** — single PR for #47 + #102.

## Housekeeping leftovers

- **Deletable local branches** (all merged to main): `fix-32-camera-exit-close`,
  `feat-32-photo-discard` (→ #112/#113), `issue-13-posthog-analytics` (→ #111),
  and backups `backup/posthog-pre-merge`, `backup/issue47-pre-merge`,
  `backup/issue3-docs-commits-2026-07-19`.
- **Archive tags** preserve deleted work: `archive/issue-32-camera-screen-fixes`,
  `archive/contextual-repriming-41`, `archive/photo-screen-flow-remote`,
  `archive/photo-screen-flow-backup`.
- **Memory:** `project_multiprovider_auth` updated (#107 merged, umbrella);
  stale `no-nitro` memory removed.

## Conventions reinforced

- Per-branch **gradual-prettier** (never repo-wide `prettier --write .`).
- Reviving closed-issue work → PR "Refs #N (closed)", no re-close, no new issue.
- **Archive-tag before deleting** any unmerged branch (cheap, recoverable).
- Verify "superseded vs still-needed" against current `main` before reviving —
  #41 looked useful but main had already solved it a different way.

---

## Part 2 — continued same day: re-merge, runtime drive, findings

Picked up the "OUTSTANDING" items above: re-merged current `main`, then ran the
actual runtime behavioral drive on an Android emulator. Found and fixed one
crash blocking all runtime testing, found and fixed a missing Maps API key,
and surfaced two real UX bugs mid-drive that are **not yet fixed** (filed but
paused). issue-47 itself is **still not landed** — now blocked on those two
follow-ups' resolution, not just the drive.

### Re-merge done

`issue-47-location-services` re-merged onto `main` (which had advanced to
`e782f38` — #112/#113 camera work). One conflict, in `useCameraCapture.tsx`:
kept `removePhoto` (needed for discard), dropped `updatePhoto` (main's
per-photo EXIF write — already intentionally absent per ADR 0002). Merge
commit `ead9489`, pushed. Gates green (tsc 0, jest 64/18, lint 0 errors,
prettier clean after a `--write` on the resolved file).

### Blocker #1 (found, fixed, PR open): Facebook SDK eager import crash

Running the app for the first time on-device, **every cold boot crashed** to
the top-level `ErrorBoundary` before any UI rendered — camera, create, cats,
all unreachable. Root cause: `src/lib/auth/FacebookSignIn.ts` did a static
top-level `import { LoginManager, AccessToken } from 'react-native-fbsdk-next'`.
Merely importing it touches a native HostObject getter that throws, because
`app.json`'s fbsdk plugin has a placeholder `appID` and
`isAutoInitEnabled: false` (Facebook is version-gated off, per
[[project_multiprovider_auth]]). Pre-existing bug from the already-shipped
multi-provider auth work (#107) — **unrelated to #47**, but fully blocking.

- Filed **issue #114**, branch `issue-114-fbsdk-eager-import-crash` off `main`.
- Fix: deferred the import to inside `getFacebookAccessToken`/
  `facebookSignOut` (dynamic `import()`), so the native module is only
  touched when Facebook sign-in is actually invoked.
- Verified on-device: before the fix, force-stop + relaunch always hit
  ErrorBoundary; after, boots into onboarding.
- Gates green (tsc 0, jest 58/16 — fewer than issue-47's count since this is
  plain `main`, no location tests — eslint 0, prettier clean).
- **PR #115 open against `main`, not yet merged.**
- To keep testing live on issue-47 without waiting for #115 to merge, the fix
  commit (`aef6e58` on issue-114) was **cherry-picked locally onto
  issue-47-location-services as `0edf439`** — local only, never pushed. This
  needs to be dropped (`git reset --hard origin/issue-47-location-services`
  or an interactive rebase) once #115 merges to main and issue-47 re-merges
  main normally — don't ship `0edf439` as-is in issue-47's real PR.

### Blocker #2 (found, fixed, uncommitted): missing Google Maps API key

Once the crash was fixed and the flow was driven manually (onboarding → mock
Google sign-in → consent → home → camera → capture → create → cats), the
**map picker (Pin Drop) rendered blank/gray** — not a code bug, a missing
credential. `app.json`'s `android` config had no `config.googleMaps.apiKey`,
so Expo's core plugin (`@expo/config-plugins/.../GoogleMapsApiKey.js`) never
injected the `com.google.android.geo.API_KEY` meta-data into
`AndroidManifest.xml` — confirmed absent by grepping the generated manifest.

User supplied a real key (`MAPS_API` in `.env.local`, gitignored). Since
`app.json` is tracked in git and a literal key there would land in history,
converted to **`app.config.js`** (extends `app.json` per Expo's standard
dynamic-config pattern — `module.exports = ({ config }) => ({ ...config,
android: { ...config.android, config: { googleMaps: { apiKey:
process.env.MAPS_API } } } })`), keeping `app.json` as-is for everything else.

- Verified: `npx expo config --json` resolves `android.config.googleMaps.apiKey`
  correctly; `npx expo prebuild --platform android` regenerated
  `AndroidManifest.xml` with the real meta-data present.
- **A rebuild to actually verify the map renders was killed mid-run by the
  user (`kill the rebuild`) — not yet re-verified on-device.**
- **`app.config.js` is untracked, uncommitted, sitting on
  `issue-47-location-services`.** Needs to be committed there — it's #47's
  own feature (the map picker), not a separate concern.

### Two real UX findings, filed but NOT fixed (issue #116, paused)

Surfaced by the user live-driving the emulator alongside me, not by me:

1. **"Done" on the single-cat detail screen is overloaded.** Confirmed in
   code: `useCatSubmit.ts:110` `handleDone` — bound to the "Done" button on
   `src/screens/submission/cats/index.tsx` (`CatObservationScreen`, one
   screen per cat) — builds/saves _this_ cat, then fires
   `Alert.alert('Submit Submission', ...)` and on confirm calls
   `submitObservation(payload)`, submitting the **entire** multi-cat,
   multi-photo submission. There is no separate "save this cat and go back"
   action, and the screen's header only has "Clear"/"Reset" (both
   destructive) — **no back/cancel affordance at all**. User's read: final
   submit belongs on a review/summary screen, not the per-cat form; this
   screen needs a real back/cancel button distinct from Done.
2. **"Review Photos" / "Re-review Photos" mislabels Box Annotation.**
   `src/components/organisms/CatPhotoSelector.tsx:52-61` — the button that
   enters `/submission/annotate` (the bounding-box-per-cat flow, i.e. Box
   Annotation per [[glossary CONTEXT.md]]) is labeled "Review Photos" /
   "Re-review Photos", which describes the wrong operation. User wants:
   - The button **removed** from `CatPhotoSelector` entirely — a
     confirmation button will be added **at the end of the box-annotation
     flow instead** (i.e. inside `src/screens/submission/annotate/`, not
     here). Not yet designed or built.
   - `CONTEXT.md` glossary's **Box Annotation** entry updated with the
     user-facing term **"Box the Cat"** (current entry also still says "Not
     implemented yet" even though `/submission/annotate` clearly has a
     working carousel — glossary is stale on that point too, not yet
     corrected).

Filed as **issue #116**, title framed as a small chore — but the user then
called it **"a major UI/UX fix: redo this screen"** (the cats/CatObservation
screen), which is bigger than #116's original framing. Branch
`issue-116-box-annotation-review-button` was created off `main` by mistake
(wrong base — `useCatSubmit`'s ADR-0002 version only exists on issue-47;
`main` has a materially different version of the same screen) and immediately
abandoned with **zero commits** before the base-branch question was even
answered — user redirected to the map bug instead. **Not decided:** whether
#116 becomes a real branch off `issue-47` (not `main`), whether it gets
split from the map/glossary chore into its own larger redesign issue, and
what the actual redesigned screen/flow looks like. No design or plan exists
yet for the "major redo."

### Current git/branch state (as of this handoff)

| Branch                                       | Base                          | State                                                                                                                                                          |
| -------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `issue-47-location-services`                 | `main` (re-merged, `ead9489`) | **checked out.** +1 local-only commit `0edf439` (fbsdk fix cherry-pick, don't push as-is). Uncommitted: `app.config.js` (Maps key fix, needs committing here). |
| `issue-114-fbsdk-eager-import-crash`         | `main` (fresh, `e782f38`)     | Pushed, **PR #115 open**, not merged.                                                                                                                          |
| `issue-116-box-annotation-review-button`     | `main` (`e782f38`)            | Created, **zero commits**, likely wrong base — see above. Not pushed.                                                                                          |
| `backup/issue47-pre-main-remerge-2026-07-30` | —                             | Checkpoint made before the re-merge, still around, safe to delete once re-merge is trusted.                                                                    |

Scratch files sitting in repo root, **not to be committed**:
`android-run.log`, `emulator.log`, `window_dump.xml`, `tap_desc.py`,
`tap_text.py` (adb/uiautomator tap-by-text/content-desc helpers, written this
session — reusable if driving the emulator again, but not project code).

### Outstanding — next session

1. **Rebuild + reinstall** on the emulator (killed mid-run this session),
   verify the Pin Drop map actually renders tiles now.
2. **Commit `app.config.js`** to `issue-47-location-services`.
3. **Resolve issue #116's base-branch question** with the user, then scope
   and plan the "major UI/UX redo" of the cats/CatObservation screen
   (probably wants a proper plan-mode pass, not freehand edits — it's bigger
   than the original chore framing).
4. Once **PR #115 merges** to main: re-merge main into issue-47 again (picks
   up the real fbsdk fix), then drop the local cherry-pick commit `0edf439`
   from issue-47's history if it's still sitting there unpushed.
5. Only after 1–4: finish the create→device→cats / pin→picker runtime drive,
   then open issue-47's own PR (for #47 + #102).
