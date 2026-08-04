# Session handoff (2026-07-25)

## Shipped this session

PR #81 (branch `issue-71-media-library-legacy-import`, open, not yet merged) bundles:

- The actual #71 fix: `setCapturedPhotos` moved ahead of the `Asset.create`
  gallery-save call, save isolated in its own try/catch.
- Onboarding navigate-before-mount crash (`router.replace` called inside a
  `setStep` updater — React requires updaters to stay pure).
- `CameraThumb.tsx` ↔ `CameraThumb.styles.ts` require cycle that left
  `THUMB_SIZE` undefined and collapsed capture-review thumbnails to near-zero
  size. Confirmed via logcat (`TypeError: Cannot read property 'THUMB_SIZE'
of undefined`) before the fix.
- Registration gate on submission: `useCatSubmit` now checks `hasPassword()`
  before showing the submit confirmation and redirects to `/register`
  instead of failing the network call after the user already filled out the
  form.
- PostHog only mounts now if the user accepted the _analytics_ opt-in
  specifically, not just general consent — `AppProviders` was gating on
  general consent alone, so the SDK's own automatic capture (sessions, app
  lifecycle) could run without the narrower analytics permission.
- Issue #68 (no reject path on consent screen): added a Decline button that
  shows an informed-consent warning with Exit/Back, Exit calls
  `BackHandler.exitApp()` on Android (iOS has no supported self-exit).
- Three **dev-only** stubs, all gated on `__DEV__`, none touch production
  behavior:
  - `src/lib/location.ts` — stubs a GPS fix (emulators rarely have a usable
    one without manually driving Extended Controls).
  - `src/utils/api.ts` `getPassword()` — auto-provisions a password on first
    read, since there's no reachable backend locally
    (`EXPO_PUBLIC_API_BASE_URL` unset) to verify a real one against.
  - `src/lib/auth/index.ts` — `authProvider` resolves a stub Google identity
    on `signIn()` instead of rejecting `NOT_IMPLEMENTED`, so `isAuthenticated`
    and the sign-in button are exercisable pre-Firebase.

All typecheck/lint/jest-clean at time of writing (12 suites, 42 tests). Two
more pieces described above (the dev auth stub and the #68 decline button)
were finished and pushed to PR #81 in the follow-up session that also built
the auth gate below — they existed uncommitted in the working tree at
handoff time, now committed as `feat(auth): stub dev sign-in provider
pre-Firebase` and `fix(consent): add Decline button with informed-consent
exit warning`.

## Full auth gate — implemented

Issue #86 (branch `issue-86-auth-gate`, stacked on top of unmerged PR #81
since it depends on the dev auth stub, the #68 decline button, and the
`hasPassword` gate PR #81 added — rebase target is `main` once #81 merges).
Plan file: `C:\Users\mattm\.claude\plans\encapsulated-popping-scott.md`
(also mirrored in memory at `project_feral_spotter_auth.md`). Built via
three parallel/sequential subagent slices, then verified together:
typecheck clean, lint clean (only the same pre-existing require-import
warnings as before), jest 14 suites / 46 tests green.

**Confirmed first-run order:**

```
Intro Flow (renamed from Onboarding, 4 slides)
  -> Sign in with Google        (authProvider — dev stub for now)
  -> Profile                    (renamed from Register; email required,
                                  city/state now optional)
  -> Analytics consent          (new screen, split out of /consent — soft
                                  opt-in, declining only disables PostHog,
                                  no exit gate)
  -> Device Photo/Media/Location consent (existing /consent screen, minus
                                  the analytics checkbox — hard gate, #68's
                                  decline/Exit-Back popup stays as-is)
  -> Authenticated home
```

**App-wide gate** (`src/screens/home/index.tsx`, replaced the
`isFirstLaunch`-only effect): `!isAuthenticated` → `/intro-flow`;
`isAuthenticated && !hasAcceptedConsent()` → `/consent` (catches someone
who signed in but abandoned the chain before the hard consent gate).
Otherwise renders today's camera home unchanged; the persistent "Register"
button, `SignInPrompt` modal, and their backing state/handlers are gone.

**Key file changes:**

- Renames: `onboarding` → `intro-flow` (route, screen folder, config file,
  tests) throughout; `register` → `profile` (route, screen folder).
- New: `/sign-in` screen (logo + "Sign in with Google" button only), `/analytics-consent`
  screen (checkbox extracted from `/consent`).
- `useConsentStore.markAccepted(analyticsEnabled)` split into
  `markAccepted()` (device disclosure only) + `setAnalyticsAccepted(bool)`
  (independent, called from the new analytics-consent screen).
- `src/screens/profile/index.tsx` (renamed from register): email stays
  required/validated; city/state are now optional; "Submit" → "Continue".
- `useCatSubmit.ts`: removed the `hasPassword()`/`/register`-redirect gate
  added earlier this session outright — redundant once auth is required
  app-wide to reach this screen at all.
- Deleted `src/components/molecules/SignInPrompt.{tsx,styles.ts}` and
  `src/lib/firstLaunch.ts` (confirmed dead — only referenced from
  `home/index.tsx` + its test, both rewritten as part of this gate).
- Filed issue #86 (this auth-gate feature itself) and #87 ("Connect users
  with local participating animal rescue groups" — feature idea surfaced
  during the design discussion, not implemented, deferred).

**Explicitly deferred, noted but not built this pass:**

- `src/utils/api.ts`'s `storePassword`/`hasPassword`/password-header
  submission mechanism is _not_ being ripped out yet — submission should
  eventually send the real auth token instead, but that's follow-up work.
  Today's dev password auto-stub in `getPassword()` keeps submission
  working in the meantime.
- Real `react-native-firebase` install — still blocked on
  `google-services.json`/`GoogleService-Info.plist` from the user. The dev
  stub `authProvider` (see below) stands in until then.
- A "log back in" path for a user who registered before but is currently
  signed out (token cleared, reinstall, etc.) — for now such a user just
  repeats `/intro-flow` → `/sign-in`, same as a brand-new user.

## Not done / needs follow-up

1. ~~Sign-in vs. Register are two disconnected systems.~~ Resolved — see
   "Full auth gate — implemented" above (issue #86).

2. ~~react-native-firebase install paused, never resumed.~~ Still true and
   still blocking the real (non-stub) version of the auth gate above, but
   tracked there now instead of as a standalone item.

3. **Docs reorg sitting uncommitted, unrelated to everything above.**
   `docs/COMBINED_STYLE_GUIDE.md` and two other files moved to
   `docs/code_standards/`, plus new `docs/agents/project_instructions.md`
   (mostly stub links, "not yet written") and two design docs including this
   one. Flagged repeatedly as out of scope for the #71 work; still just
   sitting in the working tree. Needs its own commit/branch/PR.

4. **Remaining open consent/onboarding issues** (not touched this session):
   - #64 — broader onboarding/consent UX and gating gaps (umbrella issue;
     #68 was the only sub-item closed here).
   - #70 — improve copy explaining why precise location is necessary.
   - #52 — captured photos can't be discarded from the camera carousel.
   - #51 — no close/back button on camera screen after first capture.
   - (#48/#49, MediaLibrary permission issues, were listed here in an
     earlier version of this doc as a "good next pickup" — that was
     stale; both were already fixed by prior commits 8650c06/5c36543
     and have been closed.)

5. ~~No GitHub issues exist for most of what shipped in PR #81.~~ Done —
   filed #82 (onboarding crash), #83 (require cycle), #84 (registration
   gate — note: the gate itself is slated for removal per "Approved next"
   above, but the issue documents the bug it fixed), #85 (PostHog gate).
   PR #81's body now closes #71 and #82–#85.

6. **Minor test-suite noise**: full `npx jest` runs end with "A worker
   process has failed to exit gracefully... Active timers can also cause
   this." Not investigated — likely an uncleared timer somewhere (the
   `setTimeout` race in `location.ts`'s real-GPS path is a candidate, though
   it's now bypassed in dev by the stub). Doesn't fail the suite, just noisy.

7. **#63 (setState-after-unmount crash) still open, path updated.** Found
   while auditing issues during the #86 work: the bug it describes
   (`router.replace(...)` inside `try`, `finally { setBusy(false) }` still
   firing post-unmount) was never fixed — it just moved verbatim from
   `register/index.tsx` to `profile/index.tsx` in the rename. Commented
   with the new path; left unfixed, out of scope for #86.

8. **#69 (analytics opt-out) closed.** Resolved by the #86 analytics-consent
   split — the checkbox lives on its own screen now, independently wired
   to `useConsentStore.setAnalyticsAccepted`.
