# Onboarding → Registration → Analytics → Consent — finite state machine

Describes the full first-run chain as a state machine: every screen is a
state, every user button press (and every Android hardware-back press,
which is a real transition trigger even when unhandled) is an action.
Written from current code, not a proposal — matches
`src/screens/{intro-flow,dataAgreement,sign-in,profile,analytics-consent,consent}`
and `src/screens/home/index.tsx`'s app-wide gate as of this session.

Related: `2026-07-26-registration-consent-loop-handoff.md` (the #93/#65
bugs found in this same flow, both fixed). Open issues touching this flow:
#91 (eager permission request), #96 (color/pattern — unrelated screen),
#97 (submission create/cats split — different flow, not this one).

## States

| State                          | Screen file                          | Android hardware-back                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `introFlow.T1`                 | `intro-flow/index.tsx`               | **intercepted** via `useBackHandler` (#98, 2026-08-09) — confirm-exit `Alert` (Back/Exit), same pattern as `consent`                                                                                           |
| `introFlow.T2`..`introFlow.T4` | `intro-flow/index.tsx`               | not intercepted — falls through to native stack pop (returns to the previous slide)                                                                                                                            |
| `dataAgreement`                | `dataAgreement/index.tsx`            | not intercepted — default pop, returns to whichever `introFlow.Tn` pushed it                                                                                                                                   |
| `signIn`                       | `sign-in/index.tsx`                  | not intercepted — default pop, returns to `introFlow.T4`                                                                                                                                                       |
| `profile`                      | `profile/index.tsx`                  | not intercepted — default pop, returns to `signIn` (only screen in this chain with a _visible_ header back button too, since it doesn't set `headerBackVisible:false`/`gestureEnabled:false` in `_layout.tsx`) |
| `analyticsConsent`             | `analytics-consent/index.tsx`        | not intercepted — default pop, returns to `profile`                                                                                                                                                            |
| `consent.disclosure`           | `consent/index.tsx` (default render) | **intercepted and swallowed unconditionally** via `useBackHandler(() => true)` — back button does nothing                                                                                                      |
| `consent.busy`                 | same file, `busy` state              | same interception; Agree/Decline buttons are `disabled`                                                                                                                                                        |
| `consent.blocked`              | same file, `blocked` state           | same interception (hook doesn't distinguish)                                                                                                                                                                   |
| `home`                         | `home/index.tsx`                     | default (not part of this flow's concern)                                                                                                                                                                      |

## Transition table

Format: **State — action (trigger) → target** — guard / side effect.

### introFlow

- `introFlow.T1` — press **Next** → `introFlow.T2`
- `introFlow.T2` — press **Next** → `introFlow.T3`
- `introFlow.T2` — press **Previous** → `introFlow.T1`
- `introFlow.T3` — press **Next** → `introFlow.T4`
- `introFlow.T3` — press **Previous** → `introFlow.T2`
- `introFlow.T3` — press **"Read the full data usage agreement"** (link) → `dataAgreement` (native _push_, not replace — a real sub-stack entry, not just a step change)
- `introFlow.T4` — press **Previous** → `introFlow.T3`
- `introFlow.T4` — press **"Set up FeralSpotter"** (the `Next` slot's label on the last slide) → `signIn` (`router.replace`)
- `introFlow.T1` — **Previous** is `disabled` (step===0), not a live action

### dataAgreement

- `dataAgreement` — native back (gesture or hardware button; screen has no custom handler) → `introFlow.Tn` (whichever slide pushed it — step state preserved since `introFlow` never unmounted, just backgrounded)

### signIn

- `signIn` — press **"Sign in with Google"** → calls `signIn()` (dev stub: always resolves) → on success, `profile` (`router.replace`); on rejection, stays on `signIn` (button re-enables, error logged, no user-visible error surfaced — see Gaps)

### profile

- `profile` — press **Continue** — guard: email non-empty and passes a loose regex; on failure → stays on `profile`, inline error shown, no state change. On success → `saveProfile()` (an 800ms stubbed delay, not real yet — issue #11) → `analyticsConsent` (`router.replace`)
- `profile` — city/state/firstName/lastName fields have no validation at all (any value, including empty, is accepted)

### analyticsConsent

- `analyticsConsent` — press **checkbox row** (toggles `analyticsEnabled`, defaults `true`) → same state, no transition, just local state flip
- `analyticsConsent` — press **Continue** → `setAnalyticsAccepted(analyticsEnabled)` (persisted to `consent-store`) → `consent.disclosure` (`router.replace`)

### consent (device consent / permission gate)

- `consent.disclosure` — press **Decline** → `Alert` with **Back** / **Exit**
  - **Back** → stays on `consent.disclosure` (dismisses alert only)
  - **Exit** → `BackHandler.exitApp()` — Android only; iOS has no equivalent and the button effectively does nothing there (per the code comment)
- `consent.disclosure` — press **"I Agree — Continue"** → `consent.busy` (both buttons disabled) → sequential `request()` for camera, then media, then location (Android can only show one native permission dialog at a time — this sequencing is the #67 fix)
  - if **none** of the three results is `BLOCKED` → `markAccepted()` (persisted) → `home` (`router.replace('/(home-tabs)')`)
  - if **any** of the three is `BLOCKED` → `consent.blocked` (note: `markAccepted()` still runs _before_ this check — device consent is recorded even when permission-blocked)
- `consent.blocked` — press **"Open Settings"** → `openSettings()` (OS Settings app opens; app itself doesn't transition — it's the _foreground_ event below that does)
- `consent.blocked` — **app returns to foreground** (not a button press, but a real trigger — `AppState` `'active'` event) → re-`check()`s all three permissions
  - if none still `BLOCKED` → `home` (`router.replace`)
  - if still blocked → stays on `consent.blocked`
- `consent.blocked` — press **"Continue Without Access"** → `home` (`router.replace`) unconditionally, regardless of actual permission state

## Consolidated machine (XState-shaped pseudocode)

```
introFlow.T1 --NEXT--> introFlow.T2
introFlow.T2 --NEXT--> introFlow.T3
introFlow.T2 --PREVIOUS--> introFlow.T1
introFlow.T3 --NEXT--> introFlow.T4
introFlow.T3 --PREVIOUS--> introFlow.T2
introFlow.T3 --VIEW_DATA_AGREEMENT--> dataAgreement (push)
introFlow.T4 --PREVIOUS--> introFlow.T3
introFlow.T4 --SET_UP--> signIn
introFlow.T1 --BACK--> [alert: BACK|EXIT]
  BACK --> introFlow.T1
  EXIT --> (Android) app terminates

dataAgreement --BACK--> introFlow.Tn (pop, step preserved)

signIn --SIGN_IN--> [signIn.pending]
  onDone --> profile
  onError --> signIn

profile --SUBMIT--
  guard: emailValid
  --> [profile.saving] --> analyticsConsent
  guard fails --> profile (with error)

analyticsConsent --TOGGLE_ANALYTICS--> analyticsConsent (context.analyticsEnabled flips)
analyticsConsent --CONTINUE--> consent.disclosure (side effect: persist analyticsEnabled)

consent.disclosure --DECLINE--> [alert: BACK|EXIT]
  BACK --> consent.disclosure
  EXIT --> (Android) app terminates
consent.disclosure --AGREE--> consent.busy
consent.busy --PERMISSIONS_RESOLVED--
  guard: noneBlocked --> home (side effect: persist accepted)
  guard: anyBlocked   --> consent.blocked (side effect: persist accepted, same as above)
consent.blocked --OPEN_SETTINGS--> consent.blocked (external OS navigation, no in-app transition)
consent.blocked --APP_FOREGROUNDED--
  guard: noneBlocked --> home
  guard: stillBlocked --> consent.blocked
consent.blocked --CONTINUE_WITHOUT_ACCESS--> home (unconditional)
```

## Gaps this exercise surfaced (not yet filed/fixed, flagging only)

- **Unhandled hardware-back on `dataAgreement`, `signIn`, `profile`, `analyticsConsent`** (and `introFlow.T2`-`T4`): falling through to native pop is _probably_ fine mid-chain (returns to the previous screen, which is a reasonable back action) but not re-verified. `introFlow.T1` is fixed (#98, 2026-08-09) — it now intercepts and confirms before exit, same as `consent`.
- **`signIn`'s rejection path is silent**: `catch (err) { console.error(...) }` with no user-facing feedback — a failed sign-in just re-enables the button with zero visible explanation.
- **`profile`'s optional fields have zero validation** — not necessarily wrong (they're optional), but worth confirming that's intentional for city/state free text.
- **`consent.busy`'s permission-request failure path isn't in this table** because none of the three `request()` calls have a `.catch` — an unexpected rejection (not just a `DENIED`/`BLOCKED` result) would throw inside `handleAgree`'s `try` and hit the `finally` (clearing `busy`) without ever calling `markAccepted()` or navigating, silently stranding the user on `consent.disclosure` with no error shown.
