# Handoff — feral-spotter, test-drive investigation (2026-08-07)

## Focus for next session

Investigate the test drive captured this session: `docs/test-drives/run-notes/2026-08-07-camera-catform-bubble-punchlist.md`. Read that file directly rather than re-deriving — it already separates user-reported findings (Camera screen, Cat Form screen) from agent log observations, and lists concrete follow-ups. Two leads flagged there worth chasing first:

- **Unistyles warning (29x this session)**: `we detected style object with 2 unistyles styles... use array syntax instead of object syntax`. Plausible root-cause lead for the bubble/header rendering bugs on the punchlist (off-screen bubble, header not resizing on collapse) — component/file not yet identified, needs tracing.
- **PostHog `capturer not registered` warning (4x)**: not on the user's punchlist, found only in agent log review. Needs a look against the analytics-consent gating check in `docs/agents/project_instructions.md`'s "Every emulator run" section.

None of the punchlist items are triaged into GitHub issues yet — that's the other half of "investigate": read the run-note, decide which items are real bugs vs. already-known (cross-check against open issues first — several items may already be filed), then create issues per `docs/agents/issue-tracker.md` conventions.

## Repo state at handoff

- Branch: `issue-163-first-run-reorder` (tracks `origin/issue-163-first-run-reorder`), 2 commits ahead of `ff5eabe` (`ea10568` reorder impl, `4e9208a` design-decisions doc). Clean push, PR **#194** open, not merged (Matthew's call, same pattern as prior PRs this week).
- Uncommitted working tree (all pre-existing at session start or produced this session — **not yet resolved, don't assume intent**):
  - `docs/agents/domain.md`, `docs/agents/project_instructions.md` — modified. These hold a glossary/naming cleanup (dead `../domain/glossary.md` link removed, `domain.md` row broadened to cover any coding/doc activity, a File-Format-vs-`adr`/`design-decisions`/`design` contradiction resolved). Was committed once (`f3191ab`) then **explicitly reverted** by the user ("undo the commit, only commit branch-scoped files") — these two files are **not scoped to issue #163**, don't recommit them to this branch. Where they end up (own branch? different PR?) is an open question, not decided this session.
  - 3 deleted files under `emulator/run-notes/` — the user is mid-restructure, moving run-notes into the new `docs/test-drives/` layout. Confirmed this session: the deleted files' content already exists at `docs/test-drives/run-notes/` (plus one more, `2026-08-06-cats-sprint-annotate-drive.md`, also already migrated). Don't touch — not this session's work, already in progress independently.
  - `docs/agents/test-driving.md` (untracked, now has real content — the authoritative doc for test-drive conventions, points at `docs/test-drives/{run-notes,logs,screen-captures}/`) and `docs/test-drives/` itself (untracked dir, now has real content after this session's run-note + log).
- New this session, untracked, not yet committed:
  - `docs/test-drives/run-notes/2026-08-07-camera-catform-bubble-punchlist.md` — the run-note to start from.
  - `docs/test-drives/logs/2026-08-07-punchlist-drive-full.log` — full `adb logcat -d` dump backing the agent-observations section (14,124 lines, mostly Pixel/system noise — see the run-note for what's actually relevant).
  - `docs/test-drives/temp-punchlist.md` — the user's raw, unformatted source notes. Superseded by the run-note; ask before deleting (not deleted this session, wasn't asked to).

## Device/build context (don't re-derive)

- Physical Pixel 7 (codename `panther`, serial `2A151FDH200HY4`) — user said "Pixel 6" initially, corrected to Pixel 7 mid-session once `adb devices -l` showed the real model. Worth double-checking device identity again if a new device shows up rather than trusting a verbal label.
- Debug APK built via `npm run clean-debug` (`expo prebuild --clean` + `gradlew assembleDebug`) from this branch, installed via `adb install -r` — **did not** clear app data, so the device still has prior auth session + consent state. This means the #162/#163 first-run reorder was **not exercised** by this test drive at all — if that still needs on-device verification, it needs a fresh session (`pm clear com.mmanning.feralspotter` first) with intro-flow driven from scratch.
- Metro was already running on 8081 from a prior, stale session when this one started — had to `Stop-Process` a hung `node`/`expo start --dev-client` process before restarting cleanly. If port 8081 conflicts happen again, check for a zombie process first (`Get-NetTCPConnection -LocalPort 8081`) rather than assuming a live server.
- Key discovery: this build's JS console output (`console.log`/`WARN`/etc.) does **not** appear in `adb logcat` at all (`ReactNativeJS` tag: 0 matches across the full buffer) — it only surfaces in the Metro terminal (dev-client + websocket connection). Any future log-based investigation needs the Metro terminal output captured alongside `adb logcat`, not logcat alone.

## Related, don't re-litigate

- PR #194 and the design-decision doc it added (`docs/design-decisions/first-run-flow-order.md`) — full reasoning for the reorder lives there, not repeated here.
- Map issue **#31** has a decision-pointer comment for #162/#163 already posted.

## Suggested skills

- **`/triage`** (or manual `gh issue create` per `docs/agents/issue-tracker.md`) — for turning the run-note's punchlist items into real issues. Cross-check against existing open issues first (several items — e.g. the Cat Form label staleness, the wrong-navigation-target bug — may already be filed under #66/#101 or similar; the run-note doesn't do this cross-check).
- **`diagnosing-bugs`** — for actually tracing the Unistyles warning to its source component, and for the "Not in Photo" first/last-photo asymmetry (sounds like an off-by-one in whatever list-boundary check drives that button).
- **`run`** — for the follow-up fresh-install (`pm clear`) drive to verify #162/#163, since that's still outstanding and this session's drive didn't touch it.
