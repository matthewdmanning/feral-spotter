# Handoff: Cat List / annotate / Cat Form redesign — #170 shipped, #171-174 next

**Date:** 2026-08-04
**Branch:** `sprint/cat-annotate-flow` (off `main` @ `023c550`)
**Latest commit:** `7dd3849` — "feat(cats): annotate discovers cats via first box (#170)"
**Next session's job:** work tickets [#171](https://github.com/matthewdmanning/feral-spotter/issues/171)–[#173](https://github.com/matthewdmanning/feral-spotter/issues/173), any order (all unblocked). [#174](https://github.com/matthewdmanning/feral-spotter/issues/174) stays blocked.

## Read these first (don't re-derive — the content lives there, not repeated here)

- Spec: `docs/design/grilling/2026-08-04-cats-annotate-flow-spec.md` (= issue [#169](https://github.com/matthewdmanning/feral-spotter/issues/169))
- Architecture decision: `docs/adr/0004-cats-annotate-flow.md`
- Ticket breakdown + dependency graph: `docs/sprint_planning/2026-08-04-cats-annotate-flow-tickets.md`
- The #170 diff itself: `git show 7dd3849` — not repeated here
- Originating wayfinder map: [#167](https://github.com/matthewdmanning/feral-spotter/issues/167) (coordinates with MVP exit map [#31](https://github.com/matthewdmanning/feral-spotter/issues/31), which is paused pending this)

## Tickets and current state

| #                                                                   | Title                                                             | Label             | Blocked by                                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [#170](https://github.com/matthewdmanning/feral-spotter/issues/170) | Annotate discovers cats via first box (core mechanic)             | done              | — shipped, commit `7dd3849`                                                                                             |
| [#171](https://github.com/matthewdmanning/feral-spotter/issues/171) | "Not in this photo" explicit skip button                          | `ready-for-agent` | none now                                                                                                                |
| [#172](https://github.com/matthewdmanning/feral-spotter/issues/172) | Cat Form drops manual photo selection; placeholder inset persists | `ready-for-agent` | none now                                                                                                                |
| [#173](https://github.com/matthewdmanning/feral-spotter/issues/173) | Cat List auto-skip when empty                                     | `ready-for-agent` | none now                                                                                                                |
| [#174](https://github.com/matthewdmanning/feral-spotter/issues/174) | Inset crop real component (pop-out/slide-to-side)                 | `needs-info`      | #172 **and** wayfinder [#168](https://github.com/matthewdmanning/feral-spotter/issues/168), still open (Prototype/HITL) |

#171/#172/#173 can run in any order / in parallel — each only depended on #170. #174 stays blocked until someone resolves #168 in a live session — don't attempt its visual/interaction design as an AFK agent.

## Vocabulary — use these, not domain.md's terms

**Cat List** (`src/screens/submission/create/index.tsx`), **Cat Form** (`src/screens/submission/cats/index.tsx`), **annotate** (`src/screens/submission/annotate/index.tsx`). Explicit override of `docs/agents/domain.md`'s "Submission" / "Observed Cat" / "Box Annotation" — use it in any issue comments, PR descriptions, or commit messages this work produces.

## What #170 actually built (design reasoning, not just the diff)

- `useActiveCatFlowStore` (`src/hooks/useActiveCatFlowStore.ts`) — persisted (AsyncStorage), holds **only** `activeCatId: string | null`. Split into its own file (not inlined in the hook that uses it) specifically so it's independently `jest.mock`-able, matching the one-store-per-file convention (`useBoundingBoxStore`/`useSubmissionStore`/`usePhotoStore`). Follow the same split if #171/#172 need new store state.
- `useActiveCatFlow` (`src/hooks/useActiveCatFlow.ts`) composes that store + `useBoundingBoxStore`: `activeCatId`, `getPhotoStatus(photoId)`, `handleBoxConfirmed(photoId, box)`, `handleBoxingComplete()`, `clearActiveCat()`.
  - `handleBoxConfirmed` mints a new cat id (`expo-crypto`'s `randomUUID()`) **only if** `activeCatId` is `null` — that's the whole "first box declares a cat" mechanic.
  - `handleBoxingComplete`: if a cat is active, `router.replace('/submission/cats')`; if not (Boxing Complete tapped with zero boxes drawn), treated as an abandon (`router.back()`) rather than a no-op — there's no cat to describe.
  - `clearActiveCat` is **one** method serving two different call sites (annotate's hardware-back = abandon; `useCatSubmit`'s post-save = done, not in-progress) rather than two near-identical methods — documented via comment, not duplicated. Boxes already drawn are **never** cleaned up on abandon (spec's Out of Scope) — orphaned in `useBoundingBoxStore` under the forgotten id; a later "Add a Cat" mints fresh, doesn't resume.
  - **Important gotcha if you touch `getPhotoStatus` again:** it reads `boxes[\`${activeCatId}:${photoId}\`]`directly from a **subscribed**`useBoundingBoxStore((s) => s.boxes)`slice — not through`getBoxes()`, which is a stable function reference that doesn't trigger re-renders when the underlying record mutates. Got this wrong on the first pass (see Issues below); if you add more box-derived UI state, subscribe to the slice.
- `useAnnotatePass` (`src/hooks/useAnnotatePass.ts`, new, non-persisted, screen-local) replaces the deleted `useAnnotateStateMachine.ts`. Owns the full photo pool (`usePhotoStore`, not a per-cat subset), carousel `currentIndex`/`carouselRef`, `handlePrevPhoto` (renamed from the old `handleBack` to disambiguate from the flow-level "abandon" concept), `handleLongPressRemove` (the "does this photo have another cat's annotations" check now compares against `activeCatId`). `handleConfirmBox` wraps `useActiveCatFlow.handleBoxConfirmed` then auto-advances the carousel **unless** on the last photo — Boxing Complete and per-photo box confirmation are now fully decoupled (old code conflated them in one `handleDone`).
- `AnnotateCarouselItem.tsx`: no longer calls `addBox` itself. `catId` prop renamed `activeCatId` (nullable — may not exist before the pass's first box). `onConfirm` signature changed `() => void` → `(box) => void` — the item surfaces the box, the caller persists it. Forced by "first box declares the cat": there's no id yet at the moment the very first box is confirmed.
- Hardware back (`useBackHandler`, Android-only, existing repo hook) is the **only** way to leave `annotate` mid-pass — the screen is `headerShown:false` + `gestureEnabled:false` (`src/app/submission/_layout.tsx`). Calls `clearActiveCat()`, returns `false` to let default pop proceed. **Not investigated:** iOS may have no way to leave mid-pass except the zero-photos empty state's "Go back" button — looks like a pre-existing gap, left untouched as out of #170's scope.
- **Deliberately untouched by #170:** `CatForm.tsx`/`useCatForm.ts` (photo-selector removal is #172), not-in-photo status/pill (#171), Cat List auto-skip (#173). `cats/index.tsx` needed **zero** changes — a freshly-discovered cat correctly has no `?edit=` param, so `existingCat` stays `undefined`, and `useCatSubmit` sources the id from `activeCatId` internally.

## Non-obvious facts that shaped the original design (still true, from the spec session)

- `useBoundingBoxStore` already keys boxes by `${cat_id}:${photo_local_id}` independent of whether that `cat_id` has a matching `ObservedCat` — this is _why_ "first box declares a cat" and "mid-pass abandonment keeps data" both required zero schema change.
- Known test-environment gotcha: rendering a live persisted store (real AsyncStorage rehydration) inside a model test crashes `react-test-renderer` in this RN/React/`@testing-library/react-native` combination. #170's model test (`src/hooks/__tests__/useActiveCatFlow.model.test.ts`) sidesteps this by replacing both dependency stores with **real, non-persisted `zustand.create()` stores** in the `jest.mock` factory — genuine reactivity, zero AsyncStorage involvement. Reuse this pattern rather than mocking with plain objects (which would need manual `rerender()` calls after every state change).
- Testing policy (`docs/agents/testing.md`): model-based/stateful-flow tests only, `getPathsFromEvents` for real user journeys (not `getShortestPaths`). Two precedents now exist: `HomeScreen.gate.model.test.tsx` (renders a screen) and `useActiveCatFlow.model.test.ts` (renders just the hook via `renderHook` — lighter, avoids annotate's native-heavy render tree). Prefer the hook-level pattern for anything that doesn't need actual screen rendering to assert on.
- Cat Form save still routes back to Cat List, unchanged — closed issue #135's behavior, none of these tickets touch it.
- Editing an existing cat (tap a row in Cat List) still opens Cat Form directly for MVP, no `annotate` re-entry. A documented-but-not-built future extension: a re-entry button at the bottom of Cat Form (in the spec/ADR, not in scope for #170–#174).

## Issues encountered building #170 (worth knowing before the next ticket)

1. **`expo-crypto`'s `randomUUID()` returns `undefined` in this repo's jest environment unless explicitly mocked** — jest-expo's preset doesn't provide a usable default. Cost real debugging time (a test failed in a confusing way — `getPhotoStatus` read `'pending'` even though `activeCatId` looked correctly set — root cause was boxes being written under key `undefined:photo-1`). Precedent fix, already in the codebase: `src/hooks/__tests__/useCameraCapture.test.ts` mocks it with `jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }))`. If #171/#172 mint any new ids in tests, mock this upfront.
2. **A model test passing doesn't mean the real screen re-renders correctly.** The reactivity gap above (`getBoxes` stable-ref vs. subscribed `boxes` slice) passed every test because the test calls `getPhotoStatus` synchronously right after `act()`, always reading fresh state directly — masking a bug that would show as stale dots in the actual UI. Caught only by a second advisor pass after implementation, not by tsc/jest/lint. **Lesson for #171-174: green automated checks are not sufficient evidence of correctness for anything involving cross-store derived UI state — reason through the subscription chain explicitly, or drive the actual screen if at all feasible.**
3. **Task breakdown underestimated blast radius once already: the actual UI entry point.** `src/screens/submission/create/index.tsx`'s `handleAddCat` still pushed to the old `/submission/cats` route after all the hook/store work was "done" — the whole mechanic was unreachable until this was caught and fixed. When scoping #171/#172/#173, explicitly check every screen that navigates _into_ the piece being changed, not just the piece itself.
4. Branch/doc bookkeeping (colon-in-branch-name → `sprint/cat-annotate-flow`, doc slug renames, a `.gitignore` WIP change on `docs-reorganization` that's currently **stashed** — entry `"docs-reorg gitignore wip"`, needs `git stash pop` next time that branch's work resumes) — mechanical, not code-relevant, skip unless you land back on `docs-reorganization`.

## Verification status (#170)

- `npx tsc --noEmit -p .` — 0 errors. `npx jest` — 24 suites / 89 tests passing. `npx expo lint` — 0 errors (only pre-existing `require()`-import warnings shared repo-wide). `npx prettier --check` — clean.
- **Not verified: no emulator/device run.** Native deps (Skia gestures via `useBoundingBoxFrame`, `react-native-gesture-handler`, `react-native-reanimated-carousel`) make this heavier than unit/model tests cover. Do an actual driven-through-the-app check before considering the whole sprint (not just #170) done — issue #3 above is exactly the kind of bug that only a real run catches early.

## Suggested skills

- **`mattpocock-skills:tdd`** if building #171/#172/#173 test-first — matches this repo's model-based-tests-only policy.
- **`verify`** before marking any of #171-174 done — see "Issues encountered" #2 and #3 above for why this matters more than usual on this feature.
- **`mattpocock-skills:grilling`** only if a genuine implementation question comes up that the spec/ADR doesn't answer.
- **`mattpocock-skills:code-review`** before opening any PR (Standards vs. Spec, in parallel).
