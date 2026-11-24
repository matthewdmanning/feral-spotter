# Code audit — navigation and UI components

Reviewed 2026-11-24 on `review/sonnet-code-audit` at `880c9b9`. Scope: `src/`
(JS only; routes, layouts, screens, shared UI, hooks that navigate, and the
tests covering them). `functions/src/` and `modules/*/src/` were not reviewed
for this lens. `node_modules` is absent: nothing was run, and no claim here
says a test passes or fails. Library behavior (Expo Router `push` vs
`navigate`, `NativeTabs` headers, `usePreventRemove`) is inferred from repo
comments, commit notes and call sites, not from library source.

## Summary

- **1 P1:** Android Back on the Data Agreement opened from Onboarding is
  swallowed by the still-mounted Onboarding screen (NAV-1). The shared
  `useBackHandler` has no focus awareness; the one test of it mocks the hook.
- **7 P2:** Settings opened with `push` stacks a second tab navigator over
  the draft (NAV-2); Home/Resume use `push` where the rest of the app moved to
  `navigate`/`dismissTo` after #504 (NAV-3); Annotate's three-button row
  always stacks on phones (NAV-4); Sightings merges loading, failed and empty
  (NAV-5); the Add-email dialog has no keyboard handling (NAV-6); Home paints
  before the entry gate redirects (NAV-7); Home's circles ignore the footer
  height (NAV-8).
- **8 P3 items** batched (NAV-9 to NAV-16): dead `Stack.Screen` options under
  `NativeTabs`, silent Back loss in Describe a Cat, destructive confirms that
  name no target, dead iOS Exit, ErrorBoundary exit, missing bottom insets,
  untyped `id` params, all-primary dialog buttons.
- **Tests:** 1 P1-hiding gap (NAV-T-1), 2 P2 (NAV-T-2, NAV-T-3), 3 P3.
- Counts by severity: P1 1, P2 7, P3 8 (findings); tests P1 1, P2 2, P3 3.

## Findings

### NAV-1 — P1: Android Back on the Data Agreement (from Onboarding) is swallowed by the hidden Onboarding screen

**Where:** `src/shared/hooks/useBackHandler.ts:20-26`,
`src/features/permissions/screens/intro-flow/index.tsx:53-59,82` ·
**Basis:** source · **Confidence:** confirmed
**Evidence:**

```ts
// useBackHandler.ts — subscribes for the lifetime of the mount, no focus check
const sub = BackHandler.addEventListener('hardwareBackPress', () =>
  latest.current(),
)
// intro-flow/index.tsx
useBackHandler(useCallback(() => {
  if (step === 0) confirmExitApp(exitWarningTitle, exitWarningBody)
  else goBack()
  return true
}, [step, goBack]))
// ...
onPress={() => router.push('/data-agreement')}   // :82, Onboarding stays mounted
```

`push` keeps `intro-flow` mounted beneath `data-agreement`
(`src/app/_layout.tsx:127-129` gives that route no handler). React Native
calls `hardwareBackPress` listeners last-registered-first and stops at the
first `true`. Onboarding registered after the navigation container, so its
handler runs first and always returns `true`. The navigator never sees Back.
`useDraftExitPrompt` already works around the same flaw with `useIsFocused`
(`useDraftExitPrompt.ts:27`); this screen has no such guard.
**Human path:** Fresh install on Android, no prerequisites (first run). Open
Onboarding, tap the primary button twice to reach slide 3, tap the data
agreement link. Press system Back or the gesture. Expected: back to slide 3.
Actual: the agreement stays; the hidden slide index drops 2 to 1. A second Back
drops it to 0. A third opens "Leave FeralSpotter?" over the agreement. The
header arrow works, but the slide behind has moved, so the user returns to a
different slide than they left.
**Fix:** Make `useBackHandler` subscribe only while its screen is focused
(`useFocusEffect` from `expo-router`, keeping the ref pattern). Then
`useDraftExitPrompt`'s `useIsFocused` check is redundant and can go. Every
other `useBackHandler` caller (Consent, Consent choice steps, Annotate) has
no pushed screen above it today, so the change is safe for them.

### NAV-2 — P2: Settings opened with `push` stacks a second tab navigator over the draft

**Where:** `src/features/organizations/sharing/components/SubmissionOrganizations.tsx:195`,
`src/app/submission/_layout.tsx:34` · **Basis:** source · **Confidence:** plausible
**Evidence:**

```tsx
<TextButton onPress={() => router.push('/(home-tabs)/settings')}>
  {copy.configureFields}
// submission/_layout.tsx
onPress={() => router.push('/settings')}
```

`(home-tabs)` is already the root stack's first entry. Pushing a tab route
from inside `submission` adds a second `(home-tabs)` above it, with its own
tab bar and its own Home instance.
**Human path:** Organizations on, a photo in the draft, an organization
selected on Submission Details. Tap "Configure shared fields in Settings".
Settings opens with the tab bar. Tap the Home tab, then Continue Sighting:
a second Submission Details is pushed over the stack, each running its own
`useDraftSync`, the class of bug #504 fixed. The location picker's header gear
does the same. Back unwinds it, so this is reached only by tapping a tab.
**Fix:** Open Settings as a stack screen that is not the tab group (a
`settings` route in the root stack reusing the Settings screen), or hide the
tab bar there. Needs a device check of how Expo Router resolves the push.

### NAV-3 — P2: Home Continue and Sighting resume use `push`, so a double tap stacks two Submission Details

**Where:** `src/core/home/screens/home/index.tsx:168-170` (also used as the
draft notice's `onFinish` at `:250`),
`src/features/history/components/ReportCard.tsx:84` · **Basis:** source ·
**Confidence:** plausible
**Evidence:**

```tsx
const handleContinue = useCallback(
  () => router.push('/submission/create'),
```

The PR note for #504 (`docs/implementations/2026-11-23-fix-hooks-navigation-logic-review.md`)
records that duplicate Submission Details each run their own draft sync.
Camera, Library and Take More Photos now use `navigate`/`dismissTo`; these
entries were left on `push`. The first tap leaves the old screen touchable
during the slide-in.
**Human path:** Signed in with a resumable draft. On Home tap Continue
Sighting twice within the transition (or tap an In Progress card on
Sightings). Two Submission Details are on the stack. Back from the top one
reveals the other.
**Fix:** `router.navigate('/submission/create')` as `usePhotoEntrypoints`
does. The other plain `push` sites (`sighting/[id]` in `ReportCard.tsx:86`
and `feralReports/index.tsx:41`, `/register` in `sign-in/index.tsx:91`,
`/data-agreement` in `intro-flow/index.tsx:82` and `settings/index.tsx:222`,
`/organizations` in `settings/index.tsx:164`, the location picker in
`create/index.tsx:88`) have the same double-tap duplication, with less cost.

### NAV-4 — P2: Annotate's three-button row stacks on every phone, taking height from the photo

**Where:** `src/features/annotate/screens/annotate/index.tsx:159-179`,
`src/shared/ui/molecules/ButtonRow.tsx:29-36` · **Basis:** source ·
**Confidence:** confirmed (arithmetic)
**Evidence:**

```tsx
<ButtonRow>
  <AppButton variant="secondary" size="compact" ...>← Previous</AppButton>
  <AppButton variant="secondary" size="compact" ...>Not in Photo</AppButton>
  <AppButton size="compact" onPress={handleBoxingComplete}>Done With This Cat</AppButton>
```

`requiredWidth = 3 * controlWidth.action(128) * min(fontScale, 2) + 2 * stackGap(12)`
is at least 408 at scale 1.0. `availableWidth` is the row's measured width,
screen width minus two 16dp gutters. The row stacks below 440dp wide, which is
every phone. The `compact` size exists to fit three buttons side by side
(`AppButton.styles.ts:62`) but cannot take effect.
**Human path:** Any signed-in user with a photo in the draft taps Annotate
Photos or Add a Cat. The bottom area holds three full-width buttons, about 200dp
including insets (capped at 50% by `annotationActionAreaMaxHeight`), on the
screen where the user draws boxes.
**Fix:** Decide intent. Either give this row its own width floor (a
`controlWidth` token for compact buttons) so three fit at 1.0x and stack at the
reflow scale, or accept stacking and drop `size="compact"`. Check on a 360dp
device at 1.0x and 1.3x.

### NAV-5 — P2: Sightings tab merges loading, failed and empty

**Where:** `src/features/history/hooks/useFeralReports.ts:66-69,83-85,97-99`,
`src/features/history/screens/feralReports/index.tsx:109-122` · **Basis:** source ·
**Confidence:** confirmed
**Evidence:**

```ts
const [history, setHistory] = useState<History>({ all: [], resumableId: undefined })
// ...
.catch((error) => {
  console.error('[useFeralReports] read history', error)
})
```

The hook exposes no loading or error state, and `ListEmptyComponent` always
renders "No sightings yet / Draft and submitted sightings appear here as you
create them". The standards ask for loading, empty and failed states to stay
distinct where consequences differ.
**Human path:** Signed-in user with saved Sightings opens the Sightings tab.
Until the storage read lands, the screen reads "No sightings yet / 0 total".
If the read rejects, that message stays, and the user concludes their history
is gone. Pull-to-refresh retries but nothing says it failed.
**Fix:** Return `status: 'loading' | 'failed' | 'ready'` from the hook. Render
a spinner row while loading, and a failed card with a retry (`onRefresh`)
instead of the empty card.

### NAV-6 — P2: The Add-email dialog has no keyboard handling

**Where:** `src/features/settings/screens/settings/index.tsx:236-266`,
`src/shared/ui/organisms/DialogShell.tsx:35-57` · **Basis:** source ·
**Confidence:** plausible
**Evidence:** `DialogShell` is a transparent `Modal` whose sheet is centered
(`dialogShell.styles.ts:16`, `justifyContent: 'center'`) with no
`KeyboardAvoidingView` and no keyboard-aware scrolling. The text field and the
Cancel / Send ButtonRow sit in it. Settings' own `KeyboardAvoidingView`
(`:99-102`) does not reach inside a `Modal`.
**Human path:** Signed in with a provider that returned no email, so Settings
shows "Add email" (`!accountEmail`). Tap it, tap the field. On a short phone,
or with text at 200% (the ButtonRow stacks), the on-screen keyboard can cover
the buttons, and the centered sheet does not move.
**Fix:** Wrap the sheet content in `KeyboardAvoidingView` inside `DialogShell`
(one fix for every dialog with an input) and confirm on a 640dp-tall device
with the keyboard open at 2.0x text.

### NAV-7 — P2: Home paints, with live entry buttons, before the entry gate redirects

**Where:** `src/features/auth/hooks/useEntryGate.ts:33-43`,
`src/core/home/screens/home/index.tsx:154` and `:212-245`,
`src/workflows/photo-entry/hooks/usePhotoEntrypoints.ts:41-47` ·
**Basis:** source · **Confidence:** plausible
**Evidence:**

```ts
useEffect(() => {
  if (!isReady || !consentHydrated) return
  if (!hasAcceptedConsent()) { router.replace('/intro-flow') }
```

`HomeScreen` renders everything every pass. `camera.disabled` and
`library.disabled` depend only on draft readiness and the photo source, not on
consent or sign-in. `RootLayout` only holds the splash for fonts.
The first-run decision record
(`docs/agents/ui-ux/decision-records/first-run-flow-order.md`) says OS
camera/location prompts must not precede the disclosure.
**Human path:** New install, cold start. Home draws, then redirects once auth
and consent hydrate. In that window Take Photos works: Camera opens with its
own "Allow Camera" gate, and the redirect then replaces Camera (the top
screen), not Home, leaving Home beneath intro-flow. The same replace takes
over whatever screen is on top if the session drops mid-flow.
**Fix:** Have the gate return its state and render nothing but
`AmbientBackground` while `!isReady || !consentHydrated` or a redirect is due.
That keeps the #93 loop guard and removes the interactive flash.

### NAV-8 — P2: Home's circles are sized from the screen alone, and Home cannot scroll

**Where:** `src/core/home/lib/entrypointDiameter.ts:19-24`,
`src/core/home/screens/home/index.tsx:147-152,216-245` ·
**Basis:** source · **Confidence:** plausible
**Evidence:** `diameter = shortAxis * (1 - 2 * 0.2) - gap`, about 184dp on a
360dp-wide phone. Two circles stack in portrait (about 368dp plus gaps) inside
a `flex: 1` area; the footer (draft notice and a two-button column) is
measured outside it. Nothing scrolls.
**Human path:** Resumable draft present, so the footer shows the notice, Continue
Sighting and New Sighting. On a short phone, or at 200% text (the notice and
buttons grow), the footer takes more than the screen leaves. The circles
overlap each other or the footer, and the actions are unreachable. Only
a device check settles the sizes.
**Fix:** Derive the diameter from the measured entrypoint area (`onLayout`) as
well as the screen, or let Home scroll when the content does not fit.

### P3 batch

- **NAV-9 — dead `Stack.Screen` options under `NativeTabs`.**
  `core/home/screens/home/index.tsx:193-210` sets `headerShown: true`, a title
  and header styles; `features/history/screens/feralReports/index.tsx:62` sets
  `title`/`headerShown: false`. `(home-tabs)/_layout.tsx` uses `NativeTabs`,
  which draws no header (the Sightings comment says so at `:55-61`). Home's
  own `paddingTop: rt.insets.top` (`index.styles.ts:18`) confirms no header is
  expected. The options are likely dead, and `app/_layout.tsx:90` ("each tab
  manages its own header") is stale. *plausible.* Remove them, or nest a Stack
  if Home should show the brand title.
- **NAV-10 — Back from Describe a Cat, or from an edit, discards entries
  silently.** `useAbandonCatGuard.ts:47-48` arms only for
  `!isEditingSavedCat && activeCatId !== null`. "Describe a Cat"
  (`create/index.tsx:267`) opens Cat Form with no active cat, and an edit is
  exempt. Pick attributes, press Back: the form state (plain `useState`) is
  gone without a prompt. The dialog text claims "anything you filled in here"
  but only guards the boxed path. *confirmed.* Guard on "form touched", or accept
  and align the copy.
- **NAV-11 — destructive confirms name no target.** `useRemoveCat.ts:37`
  ("Remove this cat?") and `useAbandonCatGuard.ts:61` use the same title for
  different scopes and name no cat, though `summarizeCat(cat)` is at hand.
  `useAnnotatePass.ts:144` ("Remove photo from submission?") names no photo
  (it could say "Photo 2 of 5"). The standard asks for a specific target and
  scope. *confirmed.*
- **NAV-12 — dead and missing exits on the first-run gates.**
  `confirmExitApp.ts:22`: on iOS "Exit" only closes the dialog, so Decline on
  Consent offers a button that does nothing there (iOS builds may not ship yet).
  The blocked state (`consent/index.tsx:32-41`) swaps the screen for a gate
  with only Open Settings; the hook still swallows Back (`:21`), so Decline
  vanishes and a blocked user has no in-app way out. *confirmed.*
- **NAV-13 — ErrorBoundary fallback.** `ErrorBoundary.tsx:75-79` offers only
  Try Again and prints `error.message`. Both boundaries (`AppProviders.tsx:222`,
  `submission/_layout.tsx:62`) wrap the whole navigator, so a persistent render
  error re-throws on retry, and nothing leaves the failing screen. Back
  (Android) or the root edge swipe (iOS) works but is not offered. *plausible.*
  Add a Go Home action (`goHome`, as `GateScreen` does) and reset on pathname
  change.
- **NAV-14 — missing bottom safe-area inset on scrolling content.**
  `register/index.styles.ts:9`, `consent/index.styles.ts:9`,
  `dataAgreement/index.styles.ts:8` and `cats/index.styles.ts:9` end with a
  fixed padding (24 to 32dp) and no `rt.insets.bottom`, while
  `sightingDetail`, `ConsentChoiceScreen`, `create` and the org screens add it.
  With 3-button Android navigation (48dp) the last button (Create account,
  Decline, Remove this Cat) sits partly under the system bar at full scroll.
  *plausible.*
- **NAV-15 — untyped `id` route params in org screens.**
  `MembersScreen.tsx:14`, `OrganizationScreen.tsx:18,25`,
  `SharedSightingsScreen.tsx:169` read `useLocalSearchParams<{ id: string }>()`
  and pass `id` straight to queries, while Sighting detail uses `firstParam`
  (`routeParam.ts`). Deep links are forced to `/` (`+native-intent.ts`), so only
  internal links reach them; low risk. *confirmed.*
- **NAV-16 — all neutral dialog buttons render primary.**
  `AlertHost.tsx:25-28` maps anything not `cancel`/`destructive` to `primary`.
  The no-photos dialog (`useNoPhotosPrompt.ts:45-55`) shows Take Photos and Just
  Describe, both primary, competing. *confirmed.* Allow a button `style` that
  maps to `secondary`.

## Test findings

### NAV-T-1 — P1-hiding gap: no test drives Back through the Onboarding to Data Agreement stack

**Where:** `src/features/permissions/screens/intro-flow/__tests__/IntroFlowScreen.test.tsx:18-27` ·
**Basis:** test-read
**Evidence:** The suite mocks both `expo-router` (`router: { replace, push }`)
and `useBackHandler` (it captures the handler into a variable and calls it
directly). The link test only asserts `router.push` was called with
`/data-agreement`.
**Mutation missed:** Removing the focus guard, or any change that leaves the
handler active under another screen (NAV-1), keeps every case green. It also
passes if `useBackHandler` is never registered at all. `useBackHandler` has no
test of its own.
**Fix:** One real-router test with `renderRouter` and React Native's built-in
`BackHandler` jest mock (`mockPressBack`): Onboarding, advance to slide 3, push
the agreement, press Back, assert the agreement is gone and the slide is
unchanged. Add the `flow.` prefix and plain-language block when editing
(`testing.md`).

### NAV-T-2 — P2: `useAbandonCatGuard` is tested against a hand-rolled `usePreventRemove`

**Where:** `src/features/draft-submission/hooks/__tests__/useAbandonCatGuard.test.ts:21-47` ·
**Basis:** test-read
**Evidence:** The file replaces `usePreventRemove` with a "faithful stand-in"
that provides `repeat` and a returned disabler, and drives it with a fake
`GO_BACK` action. The PR notes for #504 list "Back from the first cat's Cat Form
shows the exit prompt, with one Submission Details on the stack" as a manual
step not yet run on a device. `flow.catPass.test.tsx` runs the real router, but
through intent functions (`abandonCatPass()`), not through the header Back.
**Mutation missed:** A real `usePreventRemove` signature or behavior that
differs from the stand-in (no `repeat`, or `POP_TO` from `dismissTo` not
blocked, or blocked while the guard ignores it) would pass. A guard that blocks
the save's own `dismissTo` is the failure the "lets a save through" case exists
for, and only the real hook can prove it.
**Fix:** Add a `renderRouter` flow for the first cat: Cat Form with an active
cat, press the real header Back, assert the dialog, press the real Remove
button, assert the stack and cleared boxes.

### NAV-T-3 — P2: `ButtonRow` is tested only with two children at width 400

**Where:** `src/shared/ui/molecules/__tests__/ButtonRow.test.tsx:12-20,42-60` ·
**Basis:** test-read
**Evidence:** `width: 400` and two `Text` children; the stack decision is read
from the requested variant, not the layout.
**Mutation missed:** The three-button row on Annotate (NAV-4) stacks at every
phone width. No case covers three children, and none asserts a width-driven
stack at font scale 1.
**Fix:** Add a three-child case at a phone width and fix the expected state
once NAV-4 is decided.

### NAV-T-4 — P3: Sightings tests encode the merged state

**Where:** `src/features/history/screens/feralReports/__tests__/FeralReportsScreen.test.tsx:15-17,36-49` ·
**Basis:** test-read
**Evidence:** `useFeralReports` is mocked wholesale, and "shows the empty state
… before any report exists" returns `caches: []` with no loading flag. The
hook has no test of its own (`history.test.ts` covers only the pure lib).
**Mutation missed:** The first-load and read-failure behavior in NAV-5.
**Fix:** A hook test with a rejected and a pending read, once the hook exposes a
status.

### NAV-T-5 — P3: Home gate model mocks the auth hook and router

**Where:** `src/core/home/screens/home/__tests__/HomeScreen.gate.model.test.tsx:15-21,92-103` ·
**Basis:** test-read
**Evidence:** `useAuth` is replaced with `jest.mocked(useAuth).mockReturnValue`
rather than seeding `useAuthStore` (real store, per `testing.md`); `expo-router`
is mocked, and the outcome is `router.replace` calls.
**Mutation missed:** What the user sees before the redirect (NAV-7), and what
stack results (the replace targets the top screen, not Home). Never fails on a
gate that redirects correctly but late.
**Fix:** Seed `useAuthStore`; add one `renderRouter` case asserting the
visible screen and final stack for a new install.

### NAV-T-6 — P3: navigation asserted through mocks or intent calls

- `useCatSubmit.saveNavigation.test.ts:17-18,46,69`: mocked `router`;
  asserts `dismissTo('/submission/create')`. The title still says "replaces".
  The real stack effect is covered only by `flow.catPass` calling
  `returnToCatList()` on stub routes, so a wiring change in the screen is
  caught by neither.
- `CreateScreen.backPrompt.model.test.tsx:27-75,131-135`: mocks `expo-router`,
  `useBackHandler`, `useSubmissionSubmit`, `useDraftSync`; the `home` state
  only asserts `mockDiscard` was called and the `camera` state a mocked
  `router.navigate`. Discard never reaches Home in this test.
- `flow.cameraDone.test.tsx` has no event for the Close (X) button with photos
  taken; `handleClose` (`useCapturedPhotoWorkflow.tsx:216`, `router.back()`) is
  untested.

## Handoffs

- `review-aesthetics-tokens`: copy that explains control behavior:
  `annotate/index.tsx:69` ("Long press to remove.") shown on a plain tap;
  hardcoded UI copy in routes/screens: `consent/index.tsx:15,35,37`,
  `confirmExitApp.ts:17-18`, `create/index.tsx:118,153,179,189,256,281,297`,
  `settings/index.tsx:164-166`, `feralReports/index.tsx:62,89-90,117-119`,
  `ReportCard.tsx:46,59`, `location-picker/index.tsx:73-85`,
  `useAbandonCatGuard.ts:61-66`, `useRemoveCat.ts:37-38`, `ErrorBoundary.tsx:66-79`.
- `review-aesthetics-tokens`: literals: `home/index.tsx:126` (opacity 0.5 and
  grayscale over `AppButton`'s own 0.7 disabled opacity at
  `AppButton.styles.ts:85`, about 0.35 effective), `CheckboxBox.styles.ts:8`
  (`borderWidth: 1.5`), `camera/index.styles.ts:120-132` (78/62/4),
  `dialogShell.styles.ts:23` (`maxWidth: 360`).
- `review-aesthetics-tokens`: Submission Details shows the header title
  "Submission Details" and an in-body "Sighting" title (`create/index.tsx:118`,
  `submission/_layout.tsx:24`).
- `review-duplication`: `app/_layout.tsx:72-86` and `submission/_layout.tsx:65-81`
  repeat the same `screenOptions` (header style, title renderer, tint);
  `useFeralReports.ts:66-100` repeats the `read` logic in the mount effect.
- `review-mvvm`: `settings/index.tsx:89-93` derives `capturePriority` in the
  view; `ReportCard.tsx:84-87` calls `router` from a presentational card.
- `review-logic`: `CameraTopBar` Done (`CameraChrome.tsx`) is not disabled
  while a capture is in flight, and `handleDone` (`useCapturedPhotoWorkflow.tsx:211`)
  navigates away without waiting. Not traced; check whether the pending capture
  lands in a draft whose screen is gone.

## Open questions (design, not verdicts)

- `docs/agents/ui-ux/decision-records/cat-list-empty-state.md` names the submit
  button "Finished!"; the code labels it "Submit Sighting"
  (`create/index.tsx:297`). Needs a human to confirm which is current.
- Annotate hides all exits except "Done With This Cat" by design (the 2026-11-11
  review respected it). NAV-4 does not touch that decision.

## Not reviewed

- Native code (`modules/`, Kotlin/Swift), `android/`, `ios/`, `functions/src/`.
- `InsetCropBubble`, `AnnotateCarouselItem`, `useBoundingBoxFrame`,
  `SortableList`, `GlassSurface`, `PinInteractions` and the organization
  sharing components in detail; map views (`SightingsMap`, `SharedSightingsMap`,
  location picker) beyond navigation wiring.
- Tests not named above (about 150 files); `ConsentScreen*` and
  `SignInScreen` tests were opened only for mocking style.
- Nothing was run: `node_modules` is absent. Expo Router and `NativeTabs`
  semantics behind NAV-2, NAV-3, NAV-7 and NAV-9 need a device or library check.
- Device-only concerns (keyboard overlap, notches, 3-button navigation, text at
  2.0x) are source-derived and marked plausible where they depend on them.
