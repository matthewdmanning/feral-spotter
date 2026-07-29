# Registration→consent loop — handoff notes (2026-07-26)

Tracked as **#93** (new, filed this session), sub-issue of **#63**
("setState-on-unmounted crash on Register→Consent transition" — same code
neighborhood, different specific mechanism, not yet proven to be the same
bug). Full session context (this was found while verifying #13's PostHog
work, unrelated to it): `docs/design/2026-07-26-posthog-analytics-emulator-debrief.md`.

## RESOLVED (2026-07-26, follow-up session)

**Symptom:** live emulator QA repeatedly hit: intro-flow → sign-in → profile
→ analytics-consent → **bounced back to intro-flow** instead of proceeding
to `/consent`. Confirmed via `metro.log`: 7+ separate `[profile] payload`
submissions logged across the session, i.e. the user kept re-entering and
re-submitting the profile form because something kept sending them back to
the front of the chain.

**A/B tested and confirmed pre-existing:** working tree was switched to
`main` (zero analytics/#13 changes present) and the same loop reproduced
identically. Not caused by the PostHog work.

**Working theory — NOT YET CONFIRMED, this is the actual next step:**
`src/lib/auth/useAuth.ts`:

```ts
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)  // <- starts null
  useEffect(() => authProvider.onAuthStateChanged(setUser), [])
  ...
  return { user, isAuthenticated: user !== null, ... }
}
```

Every *fresh mount* of a component using this hook renders
`isAuthenticated=false` for one commit before the effect corrects it (the
effect's `onAuthStateChanged` callback fires synchronously with the real
value, but one render late). `src/screens/home/index.tsx`'s app-wide gate:

```ts
useEffect(() => {
  if (!isAuthenticated) router.replace("/intro-flow");
  else if (!hasAcceptedConsent()) router.replace("/consent");
}, [isAuthenticated]);
```

acts on that transient `false` immediately. Suspected sequence: consent
Agree → `router.replace('/(home-tabs)')` → `HomeScreen` mounts fresh → first
render sees `isAuthenticated=false` → gate fires `router.replace('/intro-flow')`
→ one tick later the real (`true`) value lands, too late, the wrong redirect
already dispatched.

**Ruled out (via architecture review, don't re-investigate as a fresh idea):**
a theory that `HomeScreen` stays mounted in the background (React
Navigation `unmountOnBlur: false`) and its stale `useAuth` subscription
races with `sign-in`'s own `router.replace('/profile')`. `router.replace`
removes the route, so `HomeScreen` most likely unmounts rather than
lingering — `unmountOnBlur` governs push-stacks, not replace. The
fresh-mount-flash theory above is simpler, fully explains the symptom, and
is the one to verify first.

**Also ruled out:** `AppProviders.tsx` conditionally wraps the whole app in
`<PostHogProvider>` once `hasAcceptedConsent && hasAcceptedAnalytics` (both
set across analytics-consent's Continue and /consent's Agree) — a tree-shape
toggle at the app root would force React to unmount/remount everything
below it, not just `HomeScreen`, which looked like a stronger candidate than
the plain fresh-mount theory. Dead on arrival, though: the gate is
`IS_PRERELEASE && POSTHOG_KEY && hasAcceptedConsent && hasAcceptedAnalytics`,
and `EXPO_PUBLIC_POSTHOG_KEY` is unset in both `.env` and `.env.local` — the
ternary always renders plain `children`, so the wrapper never toggles in
this environment. Don't re-investigate this angle unless the Posthog key
gets configured.

**Fix implemented:** rather than patch the flash in place (per-component
`isReady` + sync-init `useState`), auth state was moved out of component
lifecycle entirely into a module-scoped store — `src/lib/auth/authStore.ts`
(zustand, no persistence — the auth provider itself is the source of truth,
mirrors the shape of `useConsentStore` but deliberately doesn't persist a
second copy of `user` to avoid divergence from the provider). It subscribes
to `authProvider.onAuthStateChanged` exactly **once** at module load, not
per-component, so a component mounting fresh reads whatever the store
already holds immediately — the per-mount "start from a placeholder, correct
one render later" flash can't happen at all, regardless of render timing.

- `IAuthProvider.ts` — added `getCurrentUser(): AuthUser | null` (both the
  dev stub and the not-implemented placeholder implement it).
- `authStore.ts` (new) — `useAuthStore` holds `{ user, isReady }`;
  `isReady` flips true once the provider has reported at least once. This
  is also required groundwork for a real async provider (Firebase
  cold-start session restore) — not throwaway.
- `useAuth.ts` — rewritten to read from the store instead of owning its own
  `useState`/`useEffect` subscription.
- `home/index.tsx`'s gate — now does nothing while `!isReady` ("never act
  on indeterminate auth state") instead of acting on a possibly-stale
  `isAuthenticated`. The `[home-gate]` diagnostic log was removed along with
  the fix (no longer needed — confirmed the theory, its job is done).
- `intro-flow/index.tsx`'s `[intro-flow]` diagnostic log also removed
  (was for #65, already resolved).
- `HomeScreen.test.tsx` updated: existing mocks of `useAuth` needed
  `isReady: true` added (undefined would make the gate a no-op); added a
  new test asserting no redirect while `isReady: false`.

**Verified live** on the emulator: cleared logcat, force-stopped, cold
launch, drove the full chain by hand (intro-flow → sign-in → profile →
analytics-consent → **Agree**) and landed on `/(home-tabs)` and *stayed*
there — no bounce to `/intro-flow`, a single `Running "main"` log line (no
unexpected reload), no repeated `[profile] payload` submissions. Previously
this transition reproduced the loop every time.
`npx jest` (home/sign-in/auth/intro-flow suites) and `npx tsc --noEmit`
both clean.

**Not yet done (deliberately deferred, per the original fix-shape ordering):**
relocating the gate itself from `HomeScreen`'s effect to `_layout.tsx`
(expo-router `<Redirect>`/protected-route pattern) so it's evaluated once,
centrally, instead of inside a destination screen. The store-based fix
above already removes the flash that motivated this, so it's no longer
required to close #93 — worth doing later as a structural cleanup, not a
bug fix.

**Original symptom writeup, for reference:**

## Diagnostics added this session (now removed — kept here for the log trace they produced)

Two `console.log` lines were added purely to confirm the theory above.
Both have since been **removed** as part of the fix (see "Fix implemented"
above) — logged here only because the trace they produced is the actual
confirmation evidence:

- `src/screens/home/index.tsx`, inside the gate `useEffect`:
  ```ts
  console.log("[home-gate] fired isAuth=", isAuthenticated, "consent=", hasAcceptedConsent());
  ```
- `src/screens/intro-flow/index.tsx`, right before the `return`:
  ```ts
  console.log("[intro-flow] render step=", step, "button=", slide.button);
  ```
  (added for a *separate* but adjacent live report — see "Also observed" below.)

**CONFIRMED (2026-07-26, follow-up session)**, via `adb logcat | grep
home-gate`:

```
20:55:03.754  [home-gate] fired isAuth= false, consent= true
20:55:03.823  [home-gate] fired isAuth= true,  consent= true   (69ms later)
20:55:03.838  [intro-flow] render step= 0                       <- bounced back
```

Reproduced twice more the same session (21:57:46, ~176ms flash before
correction; 21:58:37, no correcting fire observed at all that time). Exactly
the fresh-mount-flash sequence theorized above: gate fires on the transient
`isAuthenticated=false`, redirects to `/intro-flow` before the real `true`
value lands one tick later. **Implement the fix below next** — no longer a
theory.

## Recommended fix shape, once confirmed (DONE — see "Fix implemented" above; items 1+2 were superseded by moving straight to the item-3 store rather than patching `useState` first, item 4 deliberately deferred)

1. Give auth an `isReady` flag (false until the provider has reported once
   via `onAuthStateChanged`). The gate renders a splash/nothing and issues
   **no redirect** while `!isReady` — never act on indeterminate auth state.
   This is also required groundwork for real Firebase (async cold-start
   session restore), not throwaway work.
2. Initialize `useAuth`'s state synchronously where possible —
   `useState(() => authProvider.getCurrentUser())` instead of
   `useState(null)` — so there's no flash at all for the dev stub provider.
3. Make auth a persisted zustand store mirroring `useConsentStore`, instead
   of per-component `useState` + subscription. Also ends the
   "must re-sign-in after every Metro reload" pain that repeatedly disrupted
   this session's testing (`src/lib/auth/index.ts`'s dev stub holds
   `currentUser` in a bare in-memory `let`, never persisted).
4. **Only then** relocate the gate from `HomeScreen`'s effect to
   `_layout.tsx` (expo-router `<Redirect>`/protected-route pattern) so it's
   evaluated once, centrally, instead of inside a destination screen. Do
   this last — relocating before the ready-state fix just moves the same
   flash to a different component; a root-layout gate reading the same
   flashing `useAuth` sees `isAuth=false` on its first render too.

## #65 — RESOLVED (2026-07-26, follow-up session)

Intro-flow's "Next"/"Previous" buttons (and, it turned out, every
`AppButton` in the app — e.g. sign-in's "Sign in with Google") rendered
with no visible fill/text: the `Pressable` was there and fully
touch-functional (tapping the invisible area advanced `step`/fired
`onPress` normally), just painted with zero color. This session's earlier
guess that sign-in's button "worked" was based on a glance, not a pixel
check — it had the exact same problem, which is what pointed away from
intro-flow-specific causes (nav round-trip, view-flattening, stale
Fragment layer) and toward something global.

**Root cause:** `babel.config.js` was missing the mandatory
`react-native-unistyles/plugin`. Confirmed via Context7 docs
(`react-native-unistyles` v3 setup guide): without this plugin, variant
styles never become reactive — `AppButton`'s `primary`/`secondary`
`backgroundColor` (set via `styles.useVariants({ variant })` in
`AppButton.tsx`) silently never applied. Non-variant styles (plain
`StyleSheet.create` entries, no `variants:` block) were unaffected, which
is why everything else on screen rendered fine and made the bug look
button-specific.

**Fix:** added `plugins: [["react-native-unistyles/plugin", { root: "src"
}]]` to `babel.config.js`. Verified live on the emulator: sampled button
fill pixels before (uniform background color, no accent) and after
(exact match for `theme.colors.accent` `#6EA8FE`). Required a full Metro
cache clear (`npx expo start --clear`), not just Fast Refresh, since the
plugin runs at transform time.

**User-confirmed fixed** in this session.

## Other context worth knowing before touching this area

- **#67** (settings-grant doesn't advance consent flow) was fixed this
  session (`fix(consent): request permissions sequentially, recover from
  Settings grant`, branch `issue-67-consent-blocked-gate-recheck`,
  committed `10e544b`) — sequential permission requests instead of
  `Promise.all` (Android can only show one dialog at a time), plus an
  `AppState`-triggered re-check so returning from Settings clears the
  blocked gate. This is a **real, separate, already-fixed** bug — don't
  confuse it with the loop in this handoff when reproducing.
- **#91** (filed this session): consent screen requests
  camera+media+location all up front; should defer media-library
  specifically to point-of-use (`pickFromLibrary`). Not implemented.
- User raised a decision claim — "we decided no continue-without-access
  option" — that could not be verified anywhere in git history, design
  docs, or the issue tracker. Only documented decision found is the
  *disclosure*-screen Decline forcing exit (#68, closed) — a different
  screen/button than `/consent`'s "Continue Without Access" gate. Needs a
  human answer on where/whether this was actually decided before removing
  that button.
