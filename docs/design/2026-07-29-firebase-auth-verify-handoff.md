# 2026-07-29 — Firebase Auth: live-verify progress, gate-model work pending

Continues `2026-07-28-firebase-auth-verify-handoff.md`. Branch: **`issue-7-firebase-auth-migration`**.

## Settled this session

- **The "profile screen should be Firebase auth" concern is resolved — no code change needed.** issue-7 already deletes the manual email/name/city/state form (commit `923e679 refactor: remove profile screen, collapse into sign-in -> analytics-consent`). `main` still has `src/app/profile.tsx`; issue-7 does not. Matthew confirmed the intent: **just Google sign-in, no form.** The form he kept seeing was the **old 07-25 APK's embedded (main-based) bundle** — Metro served issue-7 JS the whole time, which is exactly why the first launch crashed on RNFBAppModule (issue-7 JS calling Firebase against old native).
- **Firebase native now verified working at runtime.** Matthew rebuilt with `expo prebuild --clean && cd android && .\gradlew assembleDebug`. That only _builds_ the APK — it was never installed, so the emulator kept running the old 07-25 build. After installing the fresh APK (`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`), **RNFBAppModule error is gone (0 occurrences), app renders clean.** This is the first real runtime proof Firebase native links.

## Field notes from live driving → issues filed (no branches)

- **#103** (parent, enhancement + UI/UX) — Camera screen: manual-upload entrypoint and purpose text. Two sub-issues:
  - **#104** — Camera: add entrypoint for manual photo upload (select existing photo, not only take one).
  - **#105** — Camera: add text indicating the screen is for taking a picture.
- **#106** (bug) — Move Submit action to the **cat-list** screen. Currently Submit lives on each individual cat screen → user can submit before all cats are entered (accidental incomplete submission).

## Open — needs Matthew's input (blocked the session)

- **XState gate-model transition update (the last request, unfinished).** Only real XState machine is the model-based test `src/screens/home/__tests__/HomeScreen.gate.model.test.tsx` (`gateMachine`) — it models HomeScreen's auth/consent gate. It currently **mirrors the live gate exactly** (initializing → unauthenticated `/intro-flow` / authenticatedNoConsent `/consent` / ready; SIGN_IN, AGREE_CONSENT transitions). So "update transitions" is **not** a drift fix. Waiting on which transition to add/change (candidates raised: a sign-out transition `ready → unauthenticated`; a new gate step for analytics-consent or data-agreement between sign-in and consent; a changed redirect). Do not guess — get the spec, then update the machine **and** its `testParams` (states + events) together.
- **Peer-dep flag still not persisted** (carried from 07-28): CI `npm ci` / fresh clone / EAS still hit the same `ERESOLVE`. Decide: commit `.npmrc legacy-peer-deps=true` on issue-7, or fold into `issue-54-peer-dep-conflict`.

## Uncommitted / loose ends

- **`CONTEXT.md` is new and uncommitted** — created via `/domain-modeling`. Glossary: **Onboarding** (first-run flow explaining purpose + why permissions needed; code route `intro-flow`; _avoid_ "tutorial"), **Tutorial** (in-feature guidance for a complex op; teaches Annotation; **not implemented**, only scaffolded then deferred to #30), **Annotation** (mark-up of a captured photo; the one complex op; not implemented), **Consent** (explicit acceptance + permission grant). Commit it if the model is agreed.
  - Naming confirm still open: canonical domain term = **Onboarding**, code uses `intro-flow` (deliberate rename, commit `d52d01b`). Matthew to confirm Onboarding-as-concept / intro-flow-as-code is right.
  - Code drift flagged, not fixed: `src/config/introFlowCopy.ts` calls itself "tutorial slides", exports `TUTORIAL_SLIDES`, cites `tutorial_copy.md` — should use onboarding vocab. Separate small refactor (no issue filed yet).
- **issue-21 cleanup half-done.** 16 merged branches deleted successfully. `issue-21-style-guide-lint-enforcement` **not** deleted: its stashes `stash@{2}`/`stash@{3}` hold the deferred tutorial skeleton — confirmed **byte-identical to the open `issue-30-annotation-tutorial-implementation` branch** (2 commits, all tutorial files), so the stashes are redundant. Backup tags `backup-stash-issue21-2` / `-3` created. **The `git stash drop` was blocked by the permission classifier** — Matthew to run:
  ```
  git stash drop stash@{3} && git stash drop stash@{2}
  git branch -d issue-21-style-guide-lint-enforcement
  git tag -d backup-stash-issue21-2 backup-stash-issue21-3   # once satisfied
  ```
- **`origin/matthewdmanning/issue12`** still on remote (PR#55 merged) — deletable: `git push origin --delete matthewdmanning/issue12`.
- **#30 skeleton-location note never posted.** Agreed the fact ("skeleton lives on the issue-30 branch, byte-identical to the redundant stashes") should live on issue #30, not the glossary — but the comment was not posted. Post it when convenient.

## Runtime environment state (for next live run)

- **Emulator instability root cause = RAM exhaustion**, not graphics/hypervisor. Machine had **0.6 GB free of 15.7 GB**; the AVD died under load (the 393 MB install, a screencap). WHPX is fine. The GPU criticals in boot 3 were self-inflicted (a bad `-gpu swiftshader_indirect` flag) — do **not** re-add it.
  - Killed: the zombie qemu/emulator + cleared AVD locks; the **6 orphaned `node` procs from 2026-07-28 12:33** (freed commit/pagefile pressure). **WSL left running** (per Matthew — `vmmemWSL` ~1.5 GB, biggest single consumer; `wsl --shutdown` is the largest reclaim if needed).
  - **Do not launch the GUI emulator from the automation shell** — its skin window can't composite there (negative-coord `UpdateLayeredWindowIndirect` failures). **Cold-boot the AVD from Android Studio → Device Manager** (real desktop session), then drive `adb install` + deep-link.
- **Metro is up on 8081, cache cleared** (`expo start --dev-client -c`, pid 53360 — survived its task wrapper being killed). Fresh Firebase APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
- Launch recipe once a device is up:
  ```
  adb install -r android/app/build/outputs/apk/debug/app-debug.apk
  adb shell am start -a android.intent.action.VIEW -d "feralspotter://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
  ```
  Expected flow: intro-flow → **Sign in with Google** (Firebase, no form) → analytics-consent → consent → home.

## Don't

- **Don't `npm audit fix --force`** (Matthew, explicit).
- Don't touch `PROJECT_STATUS.md` directly — see `report-status-findings` skill.
- Don't merge to `main` without Matthew's explicit go-ahead.
- Don't commit `google-services.json` / `firebase.json` / `.firebaserc` (gitignored on this branch; **not** ignored on `main`/`issue-47`).
- Don't re-add `-gpu swiftshader_indirect` to the emulator; don't launch the GUI emulator from the automation shell.
