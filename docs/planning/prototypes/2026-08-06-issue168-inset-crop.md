# Inset crop — why this prototype exists

**Issue:** [#168](https://github.com/matthewdmanning/feral-spotter/issues/168) (wayfinder:prototype, part of map [#167](https://github.com/matthewdmanning/feral-spotter/issues/167))
**Prototype:** [2026-08-06-issue168-inset-crop.html](2026-08-06-issue168-inset-crop.html)

## Pain point

Mid-annotation, it's easy to lose track of which cat is currently being boxed. Today's flow splits
whole-photo-set box annotation from the per-cat form with nothing visually tying them together —
by the time the user reaches Cat Form, there's no anchor confirming which cat they're describing.

## What it adds

The **inset crop**: a static image cropped once, from the first box drawn for a cat, that stays on
screen through the rest of that `annotate` pass and persists onto Cat Form afterward. It's the
visual anchor that closes the gap above. Wiring/placement rules (static-from-first-box, persists
`annotate` → Cat Form, positioned top on Cat Form, collapsible) were settled by spec
[#169](https://github.com/matthewdmanning/feral-spotter/issues/169); the exact visual/interaction
treatment — size, collapse animation, how it reads on both screens — was left open as #168, which
this prototype answers with three variants (A/B/C) to pick or merge from.

## Decision (2026-08-06)

**B — Floating Docked Bubble.** Matthew's ruling:

- Bubble diameter = `(box diagonal + box short side) / 1.6`, computed from the confirmed box's px dimensions.
- On Cat Form the bubble must never cover a form field. Covering the "Observed Cat" title is acceptable.
- On `annotate` the bubble is hidden until the first box is drawn for the current cat — nothing to show before that.

Implementation notes captured in the prototype file: Cat Form reserves header-zone height equal to the
bubble diameter so it structurally cannot overlap fields regardless of size; the collapse interaction is
an edge-ward slide at fixed diameter, **confirmed primary** (2026-08-06). **Shrink** (scale down in place)
is the documented **fallback** if slide proves impractical at implementation time — both mechanics are
switchable in the prototype file for comparison.
Variants A and C are kept in the file as rejected alternatives, for the record.
