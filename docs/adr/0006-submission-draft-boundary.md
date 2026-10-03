---
status: accepted
---

# The Submission draft boundary: four stores, one teardown owner

A Submission **draft** is exactly four persisted zustand stores:

| Store | AsyncStorage key | Holds |
| --- | --- | --- |
| `useSubmissionStore` | `submission-store` | cats, location/time metadata |
| `usePhotoStore` | `photo-store` | the photo pool and the cloud submission id |
| `useBoundingBoxStore` | `bounding-box-store` | box geometry and absence markers |
| `useActiveCatFlowStore` | `active-cat-flow-store` | the in-progress cat's id |

Teardown of all four is owned by one module, `src/lib/submission/draft.ts`,
exposing two verbs: `discardDraft()` (Reset semantics) and `completeDraft()`
(Submit semantics). No caller enumerates the stores itself.

Decided 2026-08-24 ([#292](https://github.com/matthewdmanning/feral-spotter/issues/292)).

## Why

Every teardown caller previously re-enumerated the store list by hand,
differently and incompletely each time. The observable results:

- `useBoundingBoxStore` had no store-wide clear at all, so every submitted
  draft's box geometry stayed in AsyncStorage permanently.
- `active-cat-flow-store` was absent from the (never-called) `clearAllStores()`
  key list.
- Reset wiped cats and photos but not `activeCatId` or its boxes. The next
  draft's first box reused the stale id, so `getBoxedPhotoIds` returned photo
  ids that no longer existed and the submit payload carried boxes whose
  `cloud_storage_path` resolved to `undefined`.

A list maintained in three places is a list that drifts. One owner plus one
invariant test — asserted against actual AsyncStorage contents, not a
hand-written key list — is what stops a fifth store from repeating this.

## `submissionCache` is history, not draft

`submission_cache_*`, `submission_cache_index` and `submission_cache_current`
sit **outside** the boundary. They are the user's submission history, and the
two verbs dispose of them differently:

- `discardDraft()` hard-deletes the current row — Reset means the draft never
  happened.
- `completeDraft()` flips it to `Submitted` and releases only the current
  pointer, so the row survives for Feral Reports.

That asymmetry is precisely why the cache cannot be swept wholesale by a
generic "clear everything" helper, and why `completeDraft()` returns the
post-flip snapshot: the caller still fires `SUBMISSION_SUBMITTED` with it and
can no longer fetch it once the pointer is gone.

## `stopLocationCapture()` sits behind the seam

The GPS watch is draft-scoped by its own docstring, and it is exactly the side
effect a third caller forgets. Left running, `location.ts`'s recheck timer
reacquires GPS every `LOCATION_STALE_THRESHOLD_MS` for the rest of the process
lifetime. It is not optional cleanup, so it is not left to callers.

## What stays with the caller

Navigation. `router.replace('/')` stays in `useSubmissionSubmit`, because its
ordering against the create screen's auto-skip effect is load-bearing (#189 —
see the comment in `src/screens/submission/create/index.tsx`). Moving it behind
the seam re-opens that race. Validation, `waitForUploads`, the metadata upload,
the `Sending`/`Failed` transitions and their analytics events also stay: they
are submit-flow concerns, not draft-lifetime ones.

Each caller navigating for itself is what lets Settings' **Clear Draft** be an
escape pod. It is reachable *while a draft is live*, with Cat List, `annotate`
and the create screen all mounted behind Settings against state it just
emptied — and the create screen's mount effect won't re-run to notice. So it
routes Home (`router.replace('/')`) rather than popping back into them, the
same destination Submit and Reset use. A seam that owned navigation would have
to guess that; a seam that doesn't lets each caller say where "after this"
is.

## `start` is deliberately unowned

There is no `startDraft()`. `usePhotoStore` mints the submission id atomically
inside its own `set` (`submissionId: s.submissionId ?? randomUUID()`), and an
explicit start would reintroduce the non-atomic mint window that `2357000`
fixed. Its only natural call sites are the two capture paths that the
photo-pool work rewrites; adding it here would edit those files twice. Start
follows that work — the boundary is defined for teardown first, on purpose.

## Consequences

- A fifth draft-owned store must be added to `tearDownDraftState()`; the
  invariant test in `src/lib/submission/__tests__/draft.invariant.test.ts`
  fails otherwise, since it reads storage rather than a maintained key list.
- Settings' **Clear Draft** is the third caller, and calls `discardDraft()`.
  It replaces a **Clear Cache** button that was a no-op: it removed
  `@feralspotter_cache`, a key nothing ever wrote. #292 called the replacement
  "Clear History"; that name was rejected on landing because the button clears
  the draft and deliberately leaves history rows alone — the label has to name
  what a destructive button actually destroys.
- `clearAllStores()`, `PERSISTED_STORE_KEYS` and `src/utils/cache.ts` are
  deleted — all zero-caller, all encoding a stale idea of what a draft is.
