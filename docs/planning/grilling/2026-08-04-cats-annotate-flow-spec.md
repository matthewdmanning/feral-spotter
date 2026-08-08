# Spec: Cat List / annotate / Cat Form redesign — per-cat annotation-first

**Status:** Published as [issue #169](https://github.com/matthewdmanning/feral-spotter/issues/169), labeled `ready-for-agent` (except the inset-crop visual/interaction design, gated on [#168](https://github.com/matthewdmanning/feral-spotter/issues/168))
**Wayfinder map:** [#167](https://github.com/matthewdmanning/feral-spotter/issues/167), coordinating with the MVP exit map [#31](https://github.com/matthewdmanning/feral-spotter/issues/31)
**Tickets:** see `docs/sprint_planning/2026-08-04-cats-annotate-flow-tickets.md`

---

## Problem Statement

A user documenting a feral-cat sighting has eyes on the real animals, not the screen. Today's flow asks them to select which photos belong to a cat inside a form (a manual, error-prone step disconnected from the photos themselves), then hands them off to a separate full-photo-set box-annotation screen with no visual link back to which cat they were just describing. Across several photos of several cats, it's easy to lose track of which cat is currently being boxed — the two operations (describe a cat, box a cat) are split with nothing anchoring them together.

## Solution

Flip the order: annotate first, describe second, and keep the cat visible throughout. Cats are discovered by the act of boxing them — the first box drawn in a pass through the photo pool declares a new cat — instead of being counted or picked in advance. That cat's first box is cropped into a small inset that stays on screen through the rest of that pass and persists onto the Cat Form afterward, so the user is always looking at the cat they're describing. Cat List gains a zero-friction on-ramp: with no cats recorded yet, it skips straight into annotation instead of showing an empty list with nothing to do but tap into it.

## User Stories

1. As a user with a freshly captured/selected photo pool and zero cats recorded yet, I want to land directly in annotation instead of an empty Cat List, so that I don't have to tap through a screen with nothing on it.
2. As a user who already has at least one cat recorded, I want to land on Cat List (not auto-skip), so that I can see what I've already captured before deciding to add another.
3. As a user starting a new annotation pass, I want the very first box I draw — on whichever photo — to implicitly start a new cat, so that I never have to explicitly declare "this is a new cat" before I can start boxing it.
4. As a user mid-pass, I want the carousel to move through every photo in the pool, including ones already boxed for a different cat, so that I can box a second cat that appears in a photo I've already used.
5. As a user looking at a photo my current cat isn't in, I want a "not in this photo" button I can tap, so that I can explicitly say so instead of just swiping past and leaving it ambiguous whether I looked or not.
6. As a user who has boxed my cat in the photos it appears in, I want "Boxing Complete" to work at any point in the pass (not just on the last photo), so that I'm not forced to swipe through photos I've already handled.
7. As a user who just finished a pass, I want to be dropped straight into the Cat Form for that cat, so that I describe it while it's still fresh from annotating.
8. As a user filling out the Cat Form, I want to see a small crop of the cat I'm describing pinned near the top of the screen, so that I don't lose track of which cat this form is for.
9. As a user who wants more screen space while filling out the form, I want that inset to pop out or slide to the side, so that it doesn't get in the way when I don't need it.
10. As a user who just saved a Cat Form, I want to land back on Cat List with the new cat now showing, so that I can see my progress and decide whether to add another.
11. As a user with at least one cat already recorded, I want "Add a Cat" as an explicit tap on Cat List, so that starting a new annotation pass is a deliberate action, not something that happens automatically once I already have a list to look at.
12. As a user, I want the cat-count/approximation step some designs would add to be absent entirely, so that I'm never asked to guess a number before I've even looked at the photos.
13. As a user who backs out of an in-progress pass before reaching the Cat Form, I want the boxes I already drew to be kept (not silently discarded), so that partial work isn't lost if I get interrupted.
14. As a user tapping an existing cat's row in Cat List (MVP), I want it to open the Cat Form directly (same as today), so that editing an already-described cat doesn't force me back through annotation.
15. As a maintainer reading this spec later, I want the future (post-MVP) "re-enter annotation" button on Cat Form documented even though it isn't built now, so that the intended extension point is on record rather than rediscovered from scratch.
16. As a user, I want the Cat Form's old "select which photos show this cat" control gone, so that I'm not doing manual photo selection that duplicates what annotating already established.

## Implementation Decisions

- **New seam — a cross-screen active-cat flow hook/store** (e.g. `useActiveCatFlow`), replacing `useAnnotateStateMachine`'s current route-param-`cat_id` model. It owns: the current active cat's local id (or none), per-photo pass status (`pending` / `located` / `not-in-photo`), and the handlers driving a pass (`handleBoxConfirmed`, `handleNotInPhoto`, `handleBoxingComplete`). It must survive the `annotate` → Cat Form navigation, so it lives in a store, not local component state — likely persisted (AsyncStorage) for consistency with the repo's other stores and to satisfy the mid-pass-abandonment decision (state should still be there if the app backgrounds/restarts mid-pass).
- `annotate` (`src/screens/submission/annotate/`) no longer receives `cat_id` as a route param. It reads the active cat from the new hook/store and operates on the **full photo pool** (`usePhotoStore`), not a fixed `cat.photo_local_ids` subset (today's `useAnnotateStateMachine` reads `cat.photo_local_ids`, which won't exist yet at pass-start under the new flow).
- On the first confirmed box of a pass with no active cat, generate a new local cat id (`expo-crypto`'s `randomUUID()`, matching the pattern already used elsewhere in this codebase) and set it as the active cat. This id is reused as the `ObservedCat.local_id` when the Cat Form is later saved (`addCat`/`updateCat`, `useCatSubmit.ts`) — no new id is generated at that point.
- `useBoundingBoxStore` needs no schema change — it already keys boxes by `${cat_id}:${photo_local_id}` independent of whether that `cat_id` has a corresponding `ObservedCat` yet, so an in-progress cat's boxes already persist correctly and independently of `useSubmissionStore.cats`.
- New "not in this photo" pill button in `annotate`'s bottom bar (tap-activated, standard button — not a gesture), alongside the existing "Boxing Complete" button (which is unchanged: still callable at any point in the pass, not gated on reaching the last photo). What exactly the tap records is a TypeScript-level implementation call, not specified further here — Matthew's non-binding suggestion: a list of `photo_id`s, each carrying either its bounding-box data or an explicit absence marker.
- Cat List (`src/screens/submission/create/`) gains an on-mount check: if `cats.length === 0`, navigate straight into `annotate` with no render (no flash of an empty list, no tap required). Otherwise render normally; "Add a Cat" stays an explicit tap that re-enters `annotate`.
- Cat Form (`src/screens/submission/cats/`, `CatForm.tsx`) drops its `photoSection`/`CatPhotoSelector` entirely — no more manual photo-to-cat selection UI. `useCatForm.ts` drops `photoIds`/`handleTogglePhoto`. `ObservedCat.photo_local_ids` becomes a derived value (which photos have a `BoundingBox` for this `cat_id`) rather than form input — this was an unintended deviation from the original design in the first place, being corrected here, not a new behavior change.
- Cat Form gains the persisted inset crop: a static image (never recomputed after the first box) shown at the top of the screen, collapsible via pop-out/slide-to-side. Exact visual and interaction design is **not** decided by this spec — it's the open scope of wayfinder ticket #168 (Prototype). This spec covers only that it exists, is positioned at the top, is static-from-first-box, and must support that collapse interaction.
- Cat Form save behavior is unchanged: saves the cat, routes back to Cat List (closed issue #135's behavior, not touched by this redesign).
- Editing an existing cat (tapping its row in Cat List) is unchanged for MVP: opens Cat Form directly, does not re-enter `annotate`. A **documented, not-built** future extension: a button at the bottom of Cat Form to re-enter `annotate` for that cat, for a later release.

## Testing Decisions

- Model-based / stateful-flow tests only, per `docs/agents/testing.md` — no hand-written per-case screen tests.
- One xstate model at the new `useActiveCatFlow` seam, covering the full discovery → annotate → Cat Form lifecycle: states roughly `idle` (no active cat) → `annotating` (per-photo pass, tracking `pending`/`located`/`not-in-photo` per photo) → `catFormOpen` → back to `idle` on save. Events: `ADD_CAT_TAP` / auto-entry from an empty Cat List, `BOX_CONFIRMED`, `NOT_IN_PHOTO`, `BOXING_COMPLETE`, `FORM_SAVED`, `BACK`.
- Use `getPathsFromEvents` (UX-flow tool), not `getShortestPaths` — author the real journey (happy path plus key deviations: back, mid-pass abandonment, boxing-complete-early) as an explicit event sequence, per testing.md's guidance that shortest-paths is reachability coverage, not user experience.
- Prior art: `src/screens/home/__tests__/HomeScreen.gate.model.test.tsx` for the machine + `testParams` pattern. If the new flow's store can't be rendered live in a model test, follow `HomeScreen.photoSourceGate.model.test.tsx`'s precedent of mocking the store rather than driving it live — the #144 sprint notes document a reproducible `react-test-renderer` crash when a real persisted-store import is rendered in this RN/React/`@testing-library/react-native` combination.
- If a pure derivation function is added (e.g. computing a cat's `photo_local_ids` from its boxes), test it as a pure reducer/utility test separate from any rendering, matching the existing `usePhotoStore.source.test.ts` precedent — it doesn't need the model test's rendering seam.

## Out of Scope

- A cat-count/approximation input — explicitly removed by this redesign, not being reintroduced.
- The post-MVP "re-enter annotation from Cat Form" button — documented above as a future extension, not built by this spec.
- Exact visual/interaction design of the inset crop — open scope of wayfinder ticket #168.
- PostHog analytics/funnel event schema updates for the new sequence — left to the implementer at execution time.
- Tutorial copy/timing changes — confirmed necessary, but exact content/timing is an implementation-time call, not specified here.
- Cleanup/garbage-collection of orphaned boxes from an abandoned mid-pass cat — this spec keeps all such data; cleanup is explicitly deferred, flagged as possibly changing later.
- Anything outside the Cat List / `annotate` / Cat Form flow — location, time, auth, consent, and submission-upload behavior are untouched.

## Further Notes

- This spec is the output of wayfinder map [#167](https://github.com/matthewdmanning/feral-spotter/issues/167) ("Cats/annotate flow redesign: per-cat annotation-first spec"), which coordinates with the MVP exit map [#31](https://github.com/matthewdmanning/feral-spotter/issues/31) (paused on annotation-adjacent work pending this).
- **Vocabulary lock, explicit and deliberate**: this spec uses **Cat List**, **Cat Form**, and **annotate** throughout — not `docs/agents/domain.md`'s "Submission" / "Observed Cat" / "Box Annotation" terms. That substitution was tried during this spec's originating conversation and explicitly rejected.
- Root cause driving this redesign: it's too easy to forget which cat you're looking at mid-annotation, because today's flow has no visual anchor tying box-annotation to the per-cat form.
- One piece of this spec is not yet fully actionable by an AFK agent: the inset crop's visual/interaction design is still open (ticket #168, a Prototype/HITL ticket). The wiring and logic here (static-from-first-box, persists to Cat Form, positioned top, collapsible) are decided and buildable now; the exact look/feel/animation should wait for #168 to resolve.
