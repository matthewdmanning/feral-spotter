---
title: Email updates opt-in
tags:
  - implementation
  - consent
---

# Email updates opt-in

**Scope:** feature
**Issues/spec:** none filed; requested directly by the project owner
**Date:** 2026-10-24
**Branch/PR:** `feat/email-opt-in`

## Scope

**In scope:**

- [x] An email opt-in screen, asked before the analytics screen.
- [x] An opt-in / opt-out control in Settings.
- [x] A persisted `emailOptIn` flag in the consent store.

**Out of scope / not addressed:**

- Sending email, and any list or backend that holds opted-in addresses.
- A server copy of the choice (see Follow-ups).
- Existing installs: they do not see the screen. Their flag is off until they use Settings.

## Intent

**Purpose:** Let a user choose whether FeralSpotter may email them news and project updates. The user can change the choice at any time.

## Design decisions and reasoning

### The box starts unchecked

- **Decision:** The opt-in box is off by default. Continue without a choice means "no".
- **Reason:** Email is an opt-in. The analytics box is on by default, but analytics is a different kind of choice.
- **Affected journey/state:** `emailOptIn` state in the first-run chain.
- **Related decision:** [[agents/ui-ux/current-state/email-opt-in]]

### The flag lives in the consent store

- **Decision:** `emailOptIn` is a field of `useConsentStore`. `CONSENT_VERSION` is not bumped.
- **Reason:** The store already holds the analytics opt-in. The new flag is separate from the data-collection disclosure. Declining it never blocks the app.
- **Affected journey/state:** Settings, `emailOptIn`.

### The choice is local only

- **Decision:** The choice is stored on the device. It is not sent to a server.
- **Reason:** `docs/agents/backend.md` says Firestore is not an application database. No other store for addresses exists. A server list needs its own decision and ADR.

## What shipped

- `src/screens/email-opt-in/` and the route `src/app/email-opt-in.tsx`.
- Sign-in and register now go to `/email-opt-in`. That screen goes to `/analytics-consent`.
- `useConsentStore`: `emailOptIn`, `setEmailOptIn`, `hasOptedInToEmail()`.
- Copy in `src/content/consentDisclosure.json` (`emailOptIn`).
- A "Communications" card in Settings. The toggle applies at once, like theme and haptics. It does not wait for Save.

## Tests

**Model or flow covered:** Plain cases on a pure decision. The screen has no states beyond one checkbox.

| Test file                                                      | What it verifies                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/screens/email-opt-in/__tests__/EmailOptInScreen.test.tsx` | Continue with no choice stores off. Checking the box stores on. Both go to `/analytics-consent`. |
| `src/screens/sign-in/__tests__/SignInScreen.test.tsx`          | Sign-in now routes to `/email-opt-in`.                                                           |

**Not tested:**

- The Settings toggle. It is a direct bind of `ToggleRow` to the store.
- Registration routing. The register screen has no test.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`. No errors in `src/`. One error exists in `node_modules/phosphor-react-native` (`className` prop).
- [x] Unit/model tests: `npx jest`. 82 suites, 372 tests.
- [x] Lint: `npx expo lint src __tests__`. 0 errors. 3 warnings, none in changed files.
- [x] Formatting: `npx prettier --check` on changed files.

**Unverified:**

- [ ] Build (`npm run android`). Not run.
- [ ] Device or emulator pass of the first-run chain and the Settings toggle.
- [ ] CodeQL and security checks. These run in CI.
- [ ] `npm run typecheck` second project (`tsconfig.server.json`). Not run.

## Graveyard: pivots and corrections

### First-run FSM doc is out of date

- **Finding:** `planning/grilling/2026-07-27-onboarding-registration-consent-fsm.md` lists a `profile` screen that no longer exists. It also says analytics goes to consent. The code goes to Home.
- **Impact:** The `emailOptIn` state was added to the doc. The old parts are marked stale, not rewritten.
- **Resolution:** Left for a later doc pass.

## Follow-ups and known limitations

- [x] Tool chosen: EmailOctopus. See [ADR-0007](../adr/0007-emailoctopus-for-email-updates.md).
- [x] Sync path decided and built. See the 2026-10-26 section of ADR-0007.
- [ ] Deploy `syncEmailSubscription`. Set `EMAIL_API_KEY`, `EMAIL_LIST_ID` and `EXPO_PUBLIC_EMAIL_SYNC_URL`.
- [ ] Record when and which copy version the user saw.
- [ ] Revise the opt-in copy. See issue #417.
- [ ] Update the Play Data Safety and Apple privacy labels when email is actually sent. See `docs/references/privacy-nutrition-labels.md`.
- [ ] Add a link to the unsubscribe and the privacy policy in each email.
- Users with a hidden or missing account email (`AuthUser.email` can be `null`) can opt in, but no address exists to send to.

## Implementation updates

<!-- Append dated entries when modifying this feature after the initial implementation. -->

## 2026-11-02 — fix

**Purpose:** Codebase review: hardware Back escaped the consent steps, a killed chain never resumed, the entry gate could act before consent hydrated, re-consent sent signed-in users to sign-in, and the PostHog wrapper remounted the app when consent flipped.
**Change:**

- `ConsentChoiceScreen` swallows hardware Back; it also follows a late `defaultChecked` until touched.
- `useEntryGate` waits for `useConsentHydrated()` and routes a signed-in user to `nextConsentRoute()` when a step is unanswered (spec updated).
- `routeAfterDeviceConsent()` (consentFlow) replaces the hard-coded `/sign-in` after device consent; the foreground recheck is single-flight and catches errors.
- `AppProviders`: PostHogProvider is a zero-size sibling of the app, not its parent.
- `useBackHandler` subscribes once and calls the latest handler via a ref.
- Google sign-in dismissal throws `SIGN_IN_CANCELLED` (verified against installed v16 `isCancelledResponse`).
- Every `feralspotter://` system path lands on Home (`+native-intent.ts`), where the gate runs. The duplicate root `feral-reports` route is removed.
- Cat Form redirects a stale `edit` id instead of saving a new cat; route params are normalized (`utils/routeParam.ts`).
  Tests: Home tests now use the real consent store; the gate model adds stale-version and unanswered-step journeys. `consentFlow.test.ts` covers `routeAfterDeviceConsent`. Not checked on device.

## 2026-11-02 — fix (server)

**Purpose:** Anyone can register an email/password account with another person's address; an unverified token could unsubscribe that person.
**Change:** `setEmailSubscription` skips unsubscribe unless `email_verified` (returns 204, no provider call). Unverified subscribe is unchanged: it stays `pending` and EmailOctopus asks the owner to confirm (ADR-0007). Test: `email.test.ts` "does not unsubscribe an unverified address".
