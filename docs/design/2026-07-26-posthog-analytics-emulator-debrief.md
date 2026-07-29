# PostHog analytics emulator session — notes for debrief (2026-07-26)

Uncommitted working notes, captured mid-session per request ("make notes of
everything and we'll debrief after"). Not yet reviewed/actioned.

## #13 — PostHog analytics implementation

Branch `issue-13-posthog-analytics` (2 commits), off updated `main`:

1. `feat(analytics): add crash reporting and camera-open funnel event to PostHog`
   - `captureException` wired into root `ErrorBoundary` (`componentDidCatch`),
     try/catch-guarded so a failed report can't escalate a handled crash.
   - New `CAMERA_OPENED` (mount) and `PHOTO_CAPTURE_FAILED` (capture throw)
     events in `useCameraCapture.tsx`.
   - New `AnalyticsBridge` component in `AppProviders.tsx`, rendered inside
     `PostHogProvider`, registers **both** `registerCapture` and
     `registerCaptureException` app-wide the instant PostHog mounts.
   - This replaced the old per-screen registration (`useCatSubmit.ts`,
     `useFeralReports.ts` each called `registerCapture` in their own
     `useEffect`) — removed as dead/redundant once `AnalyticsBridge` covers
     it unconditionally.
   - **Why the bridge was necessary, not optional:** spec-review sub-agent
     caught that the camera screen mounts *before* the submission/reports
     screens that used to own registration, so `CAMERA_OPENED` would have
     silently no-op (`_capture` still null) on the primary first-run path.
     Confirmed as a real bug, fixed before commit.
   - Scope explicitly limited per user's steer ("stability/bugs/UX over
     engagement"): no annotate-screen events, no per-photo success event.
     Annotate has no failure surface to instrument (`useAnnotateStateMachine.ts`
     has zero catch blocks) — confirmed by inspection, not just asserted.
2. `chore(analytics): enable PostHog debug logging in dev builds`
   - `debug={__DEV__}` on `PostHogProvider` (not `IS_PRERELEASE`, so it
     never leaks into shipped pre-release/staging builds).

Two-axis code review ran (Standards + Spec sub-agents in parallel). Standards:
no hard violations; a few judgement-call notes (duplicated
gate-check-then-warn shape across `fireAnalyticsEvent`/`captureEvent`/
`captureException`; `AppProviders.tsx` now has a second reason to change).
Spec: caught the registration-timing bug above (now fixed).

**Verification status: incomplete.** No `posthog` string has appeared in
logcat at all this session (`adb logcat -d | grep -i posthog` → empty).
`PostHogProvider` only mounts after the full consent chain (sign-in → profile
→ analytics-consent accept → device consent) completes, and every attempt to
reach that point this session got diverted by the #91 bug below before
getting there. So **`captureException`/`CAMERA_OPENED`/`PHOTO_CAPTURE_FAILED`
have not yet been observed firing for real** — only unit-tested.

## #91 — filed: consent screen requests media/location access too early

https://github.com/matthewdmanning/feral-spotter/issues/91

Branch `issue-91-defer-media-permission-request` created off `main`, **no
commits yet** — investigation only, not implemented.

- User's ask: app should not request photo/data access up front; only when
  the user chooses to upload previously-taken images (`pickFromLibrary` in
  `usePhotoSession.ts`).
- Root cause: `src/screens/consent/index.tsx` `handleAgree` fires
  `Promise.all([request(camera), request(mediaLibrary), request(location)])`
  at consent-accept time — before the user has done anything needing media
  or location.
- **Live repro detail (added as an issue comment):** the "Permission Blocked"
  gate appeared after selecting **"Give partial access"** — Android 14+'s
  limited photo-picker grant. Likely cause: that grant returns
  `READ_MEDIA_VISUAL_USER_SELECTED`, not the `READ_MEDIA_IMAGES` this app's
  `PERMISSION_MAP.mediaLibrary` (`src/lib/permissions.ts:18`) checks for, so
  `react-native-permissions` reports the original request as not-granted —
  surfacing "blocked" for what the user experienced as a valid (if partial)
  grant. Whatever replaces the eager request needs to treat partial/limited
  as usable, not blocked.
- **Live repro detail (location):** location permission was set to "Not
  Allow" (plain `DENIED`, not `BLOCKED`) in the same consent-accept flow.
  Per `handleAgree`'s current blocked check (only `RESULTS.BLOCKED` trips the
  gate for any of the three), a denied-not-blocked location shouldn't by
  itself have caused the "Permission Blocked" screen — media library's
  partial-access case (above) is still the more likely trigger. Noting this
  so the exact combination (media=partial-access-treated-as-blocked,
  location=denied) is on record for whoever reproduces this.
- Downstream dependents flagged in the issue, not yet resolved: `useCameraCapture.tsx:143`
  only `check()`s media-library before `Asset.create()` (assumes pre-granted);
  `src/lib/location.ts` explicitly documents assuming the grant already
  happened at the consent gate.
- Related open issues on the same screen, not to duplicate: #64 (umbrella),
  #66, #67, #70.

**Unresolved from this session — needs debrief:**
- User stated "we decided no 'continue without registration / consent'
  option." I checked git history (`git log --all --grep`), design docs, and
  issue #68 (closed — "no reject affordance on consent disclosure screen")
  and could not find anything documenting a decision to remove **"Continue
  Without Access"** specifically (the button on the OS-permission-blocked
  gate, `src/screens/consent/index.tsx:82-88` — distinct from the disclosure
  screen's Decline, which already forces exit per #68). Not disputing it
  happened, just couldn't verify it from anything in the repo. Need to find
  out where this was decided, or confirm scope for #91 to include removing it.

## Live confirmation of an existing open issue: #67

https://github.com/matthewdmanning/feral-spotter/issues/67 — "Manual
permission grant in device settings doesn't advance consent flow." Live
repro this session: from the "Permission Blocked" gate, tapped "Open
Settings", granted full permissions there, returned to the app —
**view did not advance** past the blocked gate. Matches the issue exactly;
no new issue needed, just confirms it's still reproducible on current `main`.
Likely cause (not yet verified): the gate's `blocked` state is local
component state set once in `handleAgree`, not re-derived from a fresh
permission check on screen focus/foreground — so returning from Settings
doesn't re-run the check that would clear it.

## New symptom, not yet root-caused: "Continue Without Access" kicked the user back to registration/profile

Sequence observed live: intro-flow → sign-in → profile (submitted with test
data — confirmed via `metro.log`: `[profile] payload: {"city": "asdfla",
"email": "sadf@sadfl.com", ...}`) → analytics-consent → device consent →
"Give partial access" → Permission Blocked gate → tapped **"Continue Without
Access"** → landed back on the Profile/registration screen instead of home.

This is *not* simply "everything reset to the very first screen" (that
already happened once, separately — see incident below) — profile had
genuinely been submitted moments before in the same session, per the log.

Investigated but not concluded before being asked to stop and take notes:
- `handleContinueWithoutAccess` in `src/screens/consent/index.tsx` just does
  `router.replace('/(home-tabs)')`.
- `src/screens/home/index.tsx`'s app-wide gate only redirects to
  `/intro-flow` (if `!isAuthenticated`) or `/consent` (if
  `!hasAcceptedConsent()`) — **never directly to `/profile`.** So landing on
  Profile means the redirect actually went through `/intro-flow`'s own
  internal step logic, not straight from home.
- `src/lib/auth/index.ts`'s dev auth stub holds `currentUser` in a plain
  in-memory `let` — **never persisted** (`createDevAuthProvider`). Any full
  JS context reload resets it to `null`, which would flip `isAuthenticated`
  to false and bounce home's gate back toward `/intro-flow`.
- Was about to read `src/screens/intro-flow/index.tsx`'s step/state machine
  (not yet opened) to see whether it has its own persisted-vs-not step
  tracking that would explain landing specifically on the Profile step
  rather than the first intro slide — **this read did not happen yet.**
- Open question: is this a real app bug (intro-flow's step machine doesn't
  persist correctly, or re-derives the wrong step when auth state resets
  mid-flow), or fallout from the Metro-reload incident below still
  propagating (queued/delayed HMR landing at an inconvenient moment)? Not
  distinguished yet.

## Incident: I switched the checked-out branch mid-live-session without being asked

While filing #91 I ran `git checkout main && git checkout -b
issue-91-defer-media-permission-request`, which rewrote every file Metro
watches back to pre-#13 `main` state and back again. Metro log confirms two
incremental HMR rebuilds after the initial full bundle:

```
Android Bundled 9435ms node_modules\expo-router\entry.js (4586 modules)   <- initial
Android Bundled 2167ms node_modules\expo-router\entry.js (1 module)      <- main checkout
Android Bundled 100ms node_modules\expo-router\entry.js (1 module)       <- issue-13 checkout (back)
```

This wiped the non-persisted auth-stub session once (app bounced to
intro-flow's first slide, "Before you start"). User corrected me: filing an
issue+branch does not imply switching the live working tree onto it. Working
tree is back on `issue-13-posthog-analytics` now. Saved as memory
(`feedback_dont_switch_branch_live_session.md`) so this doesn't repeat.

It's possible (not confirmed) that this same reload activity, rather than a
new intro-flow bug, is what produced the "kicked back to registration"
symptom above — the timing is close enough to be a real alternative
explanation and should be checked first at debrief before assuming a new bug.

## Live confirmation of an existing open issue: #65

https://github.com/matthewdmanning/feral-spotter/issues/65 — "No
Next/Previous buttons on onboarding tutorial." User flagged the same thing
live ("onboarding screens need a 'Next' button"). No new issue needed, just
confirms it's still reproducible.

## A/B test against `main` (no #13 changes)

At user's request: analytics changes were already committed
(`fa7ff2d`/`24e424c` on `issue-13-posthog-analytics`), then working tree
switched to `main` to check whether the consent/permission/auth-navigation
symptoms above are actually caused by the #13 diff or pre-existing. Static
trace beforehand (full `git diff main issue-13-posthog-analytics` on the
touched files) found no plausible mechanism — the pre-consent render path in
`AppProviders.tsx` is byte-identical to `main`, and `captureException` is a
guaranteed no-op before consent is accepted (`shouldCapture()` returns false
synchronously). Live retest on `main` pending user's next pass.

**Result: reproduces identically on `main`.** User confirmed the same
loop (permission-blocked → continue-without-access / settings-grant doesn't
advance → bounced back through onboarding) with zero analytics changes
present in the working tree. **Conclusively pre-existing** — not caused by
#13. Root cause is #67 + #91 + the non-persisted-auth hypothesis, all
independent of the analytics work.

## Further evidence for the non-persisted-auth hypothesis

App died with no captured crash trace (buffer had no `FATAL EXCEPTION`/
`AndroidRuntime` entry for `com.mmanning.feralspotter` — either rotated out
of the ring buffer or not a JS/Java exception), landed on the home launcher.
Restarted via `am force-stop` + the `feralspotter://expo-development-client/`
deep link; camera device init logs came up clean, no crash on this launch.

Immediately after restart, navigating **analytics-consent → (tapped
continue) → landed back on onboarding/intro-flow**, not the device-consent
screen it should chain to. A full process restart (`force-stop`, not just a
JS reload) definitely resets `src/lib/auth/index.ts`'s in-memory
`currentUser` to null, so this is consistent with — and adds weight to — the
non-persisted-auth-state hypothesis already logged above for the
"'Continue Without Access' kicked back to registration" symptom: any auth
loss mid-flow appears to bounce navigation backward through intro-flow
regardless of which screen the user was actually on. Still not root-caused
in code (intro-flow's step machine, `src/screens/intro-flow/index.tsx`, has
not been read yet).

## Note for later (not investigated)

Transition to the Register/Profile page is consistently slow. Flagged by
user, not root-caused this session.

## Session housekeeping

- Emulator `Pixel_8_APIs` running, debug APK (`com.mmanning.feralspotter`)
  installed, Metro running detached (`/tmp/metro.log`), reachable via `adb
  reverse tcp:8081 tcp:8081`.
- Persistent `Monitor` task tailing logcat filtered for
  `posthog|camera_opened|photo_capture_failed|captureexception|ErrorBoundary`
  is still armed.
- Had to kill one earlier stale/hung `node` process squatting on port 8081
  (confirmed unresponsive via `curl` timeout, confirmed with user before
  killing) before Metro could start.
- User preference recorded: never take/read screenshots unless explicitly
  asked (`feedback_no_screenshots_unless_asked.md`) — verify app state via
  `adb logcat`/`dumpsys` instead.
