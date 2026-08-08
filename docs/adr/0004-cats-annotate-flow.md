---
status: accepted
---

# Cat discovery via annotation, not explicit declaration or form-based selection

A cat is no longer declared before it's boxed. The first confirmed
bounding box drawn in an `annotate` pass — on whichever photo, wherever
the user happens to see the cat first — implicitly creates that cat's
local id. There is no upfront cat-count/approximation step, and no
explicit "start a new cat" action; the act of boxing **is** the
declaration.

This moves "which cat am I currently working on" out of route params and
form state and into a new **cross-screen active-cat-flow** (a persisted
hook/store, `useActiveCatFlow`, replacing `useAnnotateStateMachine`'s
`cat_id`-route-param model). It must survive the `annotate` → Cat Form
navigation, since the cat's first-box crop persists onto Cat Form as a
memory anchor (top of screen, collapsible) and Cat Form's save commits
the same local id `useActiveCatFlow` generated.

A second, related correction: Cat Form's manual "select which photos show
this cat" field (`CatPhotoSelector`, `useCatForm`'s `photoIds`) is
removed. `ObservedCat.photo_local_ids` is now **derived** from which
photos carry a `BoundingBox` for that cat's id, not chosen by hand. This
field was an unintended deviation from the original design in the first
place — annotation-first makes the derivation the natural source of
truth, so removing it is a correction, not a new trade-off.

`annotate` also moves from operating on a cat's fixed
`photo_local_ids` subset to the **full photo pool** on every pass, since
a cat doesn't have a photo list yet when a pass starts, and a photo can
carry boxes for more than one cat.

## Considered Options

- **Explicit "New Cat" button, alongside implicit first-box** — rejected
  for now: the implicit trigger alone is sufficient (the first box always
  means a new cat when none is active), and a redundant explicit action
  adds a decision the user doesn't need to make. Not ruled out forever —
  flagged as revisitable if the implicit-only model proves ambiguous in
  practice.
- **Route-param `cat_id` retained, cat pre-created before `annotate`
  opens** — rejected: this is the status quo being replaced. It requires
  a cat to exist (and therefore a form to have been filled, or an id
  otherwise minted) before annotation can start, which is exactly the
  ordering this ADR inverts.
- **Keep manual photo selection in Cat Form, alongside derived boxes** —
  rejected: two sources of truth for "which photos show this cat" invites
  drift between them, and the manual field was never an intentional
  design decision to begin with.
- **Discard box data on mid-pass abandonment** (user backs out before
  Cat Form opens) — rejected for now: `useBoundingBoxStore` already keys
  boxes by `${cat_id}:${photo_local_id}` independent of whether an
  `ObservedCat` exists yet, so keeping orphaned data costs nothing extra
  and avoids losing partial work. Flagged as possibly changing later
  (e.g. a cleanup/GC pass), not committed to permanently.

## Consequences

- `useAnnotateStateMachine` is replaced, not extended — its core
  assumption (a `cat_id` prop naming an already-real cat) no longer
  holds.
- `annotate`'s per-photo status model gains a state distinct from
  "boxed" and "untouched": explicit absence (the "not in this photo"
  button, docs/sprint_planning's ticket 2), needed because implicit
  first-box + full-pool-per-pass leaves genuine ambiguity between "not
  reviewed yet" and "reviewed, not present" that the old model never had
  to represent.
- Orphaned box data (from an abandoned pass, no corresponding
  `ObservedCat`) can now accumulate in `useBoundingBoxStore` with nothing
  cleaning it up. Accepted for now per the option above; revisit if it
  becomes an actual storage/UX problem.
- Editing an existing cat still opens Cat Form directly for MVP (no
  re-entry into `annotate`) — this ADR doesn't change that path. A future
  (post-MVP, not yet built) extension is a button on Cat Form to
  re-enter `annotate` for an already-described cat.

See spec: `docs/planning/grilling/2026-08-04-cats-annotate-flow-spec.md`
(published as [issue #169](https://github.com/matthewdmanning/feral-spotter/issues/169)).
Originating wayfinder map: [#167](https://github.com/matthewdmanning/feral-spotter/issues/167).
