# Sprint: Cat List / annotate / Cat Form redesign — ticket breakdown (2026-08-04)

Published. Issue numbers: 1 → [#170](https://github.com/matthewdmanning/feral-spotter/issues/170),
2 → [#171](https://github.com/matthewdmanning/feral-spotter/issues/171),
3 → [#172](https://github.com/matthewdmanning/feral-spotter/issues/172),
4 → [#173](https://github.com/matthewdmanning/feral-spotter/issues/173),
5 → [#174](https://github.com/matthewdmanning/feral-spotter/issues/174).
This is the `/to-tickets` breakdown as approved by Matthew, kept here as
the sprint-planning record.

Source spec: [#169](https://github.com/matthewdmanning/feral-spotter/issues/169)
("Cat List / annotate / Cat Form redesign: per-cat annotation-first spec").
Originating wayfinder map: [#167](https://github.com/matthewdmanning/feral-spotter/issues/167),
coordinating with the MVP exit map [#31](https://github.com/matthewdmanning/feral-spotter/issues/31).

Vocabulary: **Cat List**, **Cat Form**, **annotate** — not domain.md's
Submission/Observed Cat/Box Annotation terms (explicit override, see #167's Notes).

---

## Dependency graph

```
1 (Annotate discovers cats via first box)
├── 2 (Not-in-this-photo button)
├── 3 (Cat Form drops photo selection; placeholder inset)
│   └── 5 (Inset crop real component) — also blocked externally by wayfinder #168
└── 4 (Cat List auto-skip when empty)
```

Tickets 2, 3, 4 only depend on 1 and can run in parallel once it lands.

---

## Ticket 1 — Annotate discovers cats via first box (core mechanic)

**Blocked by:** None — can start immediately

**Delivers:** a new `useActiveCatFlow` hook/store (with an xstate model +
tests) replacing `useAnnotateStateMachine`'s route-param-`cat_id` model.
`annotate` operates on the full photo pool instead of a fixed
`cat.photo_local_ids` subset. The first confirmed box in a pass with no
active cat generates a new local cat id and starts tracking it. The
existing "Boxing Complete" button is unchanged (available at any point in
the pass). Finishing a pass creates/updates the cat and navigates to Cat
Form for it. Demoable end-to-end today via the existing "Add a Cat" entry
point (Cat List's auto-skip, ticket 4, isn't required for this to work).

## Ticket 2 — "Not in this photo" explicit skip button

**Blocked by:** Ticket 1

**Delivers:** a pill button (tap, not a gesture) in `annotate`'s bottom
bar. Tapping it records explicit absence for the current photo against
the active cat, distinct from a photo that's simply been swiped past
without being boxed or explicitly marked absent.

## Ticket 3 — Cat Form drops manual photo selection; placeholder inset persists

**Blocked by:** Ticket 1

**Delivers:** removes `CatPhotoSelector`/`photoSection` from `CatForm`
and `photoIds`/`handleTogglePhoto` from `useCatForm` — this manual
selection step was an unintended deviation from the original design, not
a feature being cut. `ObservedCat.photo_local_ids` becomes derived from
that cat's boxes at save time. A plain, undesigned static crop of the
cat's first box persists from `annotate` onto Cat Form, shown at the
top — present and correctly wired, no pop-out/slide interaction yet.

## Ticket 4 — Cat List auto-skip when empty

**Blocked by:** Ticket 1

**Delivers:** on mount, if zero cats are recorded, Cat List navigates
straight into `annotate` — no render, no tap required. Otherwise it
renders normally and "Add a Cat" stays an explicit tap.

## Ticket 5 — Inset crop real component (pop-out/slide-to-side)

**Blocked by:** Ticket 3, and externally by wayfinder ticket
[#168](https://github.com/matthewdmanning/feral-spotter/issues/168)
(Prototype design — tracked separately, not created by this batch)

**Delivers:** swaps ticket 3's placeholder crop for the designed
collapsible (pop-out/slide-to-side) component once #168 resolves.
