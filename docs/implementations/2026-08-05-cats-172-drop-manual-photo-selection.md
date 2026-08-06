# Sprint:cats — #172 Cat Form drops manual photo selection (2026-08-05)

Implements #172 (ticket 3), blocked by / built on #170 and #171 (both
merged to `sprint/cat-annotate-flow` as of `559e2c1`). Branch
`issue-172-cat-form-drops-manual-photo-selection`, forked from
`origin/sprint/cat-annotate-flow` at that commit. Code complete.

## What shipped

`useBoundingBoxStore.ts`:

- New `getBoxedPhotoIds(catId): string[]` — every `photo_local_id` with a
  non-empty box array for that cat. The derivation source for
  `ObservedCat.photo_local_ids`.
- New `getFirstBox(catId): BoundingBox | undefined` — the cat's
  chronologically-first confirmed box, found via object key insertion
  order (`addBox` only ever appends a new key or overwrites an existing
  one in place, so key order == confirmation order). Skips keys left
  empty by `removeBox` so a removed first box doesn't mask a later one.

`useCatForm.ts`: `photoIds` state and `handleTogglePhoto` removed from
`CatFormValues`/`CatFormActions`/the hook body — no replacement, the
selection concept is gone, not moved.

`useCatSubmit.ts`: `buildCat`'s `photo_local_ids` now comes from
`getBoxedPhotoIds(localId)` instead of `form.photoIds`. Edit-path guard:
if the derived list is empty, falls back to `existingCat.photo_local_ids`
rather than overwriting with `[]` — protects cats saved before #170 (no
boxes recorded under their id) and any future `useBoundingBoxStore`
migration wipe from silently losing their photo list on a routine edit.
`saveLabel`'s photo-count check now reads `getBoxedPhotoIds` for the
active/existing cat id instead of `form.photoIds.length`.

`CatForm.tsx`: `CatPhotoSelector` and the `photoSection` block removed
entirely. New `catId: string | null` prop (existing cat's id, or the
in-progress `activeCatId`) drives the new inset crop.

`CatFormInsetCrop.tsx` + `.styles.ts` (new): placeholder static crop per
ticket 3 — "plain, undesigned... present and correctly wired, no
pop-out/slide interaction yet" (real component is #174, gated on
wayfinder #168). Reads the cat's first box + its photo, computes a
cover-style crop transform once `Image.onLoad` reports natural pixel
dimensions, renders as an absolutely-positioned `Image` inside a fixed
88x88 `overflow: hidden` container. Degenerate zero-area box (shouldn't
occur via the real gesture flow, but not provably unreachable) falls back
to framing the full photo around the box center instead of producing
`NaN` styles.

`screens/submission/cats/index.tsx`: pulls `activeCatId` from
`useActiveCatFlow`, computes `catId = existingCat?.local_id ??
activeCatId`, passes it to `CatForm`. `annotationEnabled` no longer
passed to `CatForm` (was only for `CatPhotoSelector`'s dot overlay) but
still passed to `useCatSubmit` for the save-label text.

`CatPhotoSelector.tsx` + `.styles.ts` deleted.

## Design decisions from advisor review

Initial draft made `buildCat` overwrite `photo_local_ids` unconditionally
on both the create and edit paths. Advisor review flagged this as a real
data-loss bug on the edit path: any cat with no boxes recorded under its
id (pre-#170 draft, or a `useBoundingBoxStore` `version: 2` migration
wipe, which already discards old box data on schema change) would have
its previously-populated `photo_local_ids` silently blanked to `[]` on a
routine "open Cat Form, change one field, save." Fixed by only replacing
when the derived list is non-empty.

Also from that review: `getFirstBox`'s original version took the first
matching _key_, not the first key with a _non-empty_ array — a box
removed via `removeBox` (leaves `[]` behind, doesn't delete the key)
would make the crop vanish rather than fall through to a later box.
Fixed to mirror `getBoxedPhotoIds`'s `length > 0` filter.

## Not tested

Per the spec's testing decisions (model/stateful-flow tests only, no
hand-written per-case screen tests) and following #171's precedent (no
`useAnnotatePass`/annotate-screen coverage exists), no new test files
were added:

- `CatFormInsetCrop`'s transform math is the only genuinely new logic in
  this diff and has **no test coverage** — it's arithmetic, not a
  store/flow seam, so it doesn't fit the existing model-test pattern.
  Flagged, not addressed; would need a plain unit test if this stops
  being a "plain, undesigned" placeholder.
- `useCatForm`/`useCatSubmit`/`CatForm` have no existing test files to
  extend (confirmed by grep before starting).

## Verification status

Gates run and passing: full `jest` suite (24 suites / 92 tests, same
count as baseline — no tests added), `tsc --noEmit` (0 errors), `eslint`
on all touched/created files (0 errors), `prettier --write` run on all
touched/created files (2 needed reformatting, rest already clean).

**Not run on-device.** The crop's transform math has never been visually
verified against a real photo/box — the handoff already flags no
on-device run this sprint for #170 or #171 either; this ticket adds a
third piece of unverified-on-device rendering logic to that backlog.

**Open question, not answered by this ticket:** `settings.annotation_enabled`
has no writer anywhere in `src/**` (`updateSetting('annotation_enabled', ...)`
doesn't exist) — it's dead config, stuck at its default `true`. The
empty-`photo_local_ids` scenario this originally flagged is therefore
unreachable today, not a live risk. The two remaining reads
(`screens/submission/cats/index.tsx`, `useCatSubmit`'s save-label text)
are the only things left depending on it. Worth confirming with Matthew:
remove it as dead code, or wire an actual toggle (which would then need
a real gate, since `handleAddCat` in `submission/create/index.tsx`
routes to `/submission/annotate` unconditionally today)?

**Known pre-existing gap, promoted from cosmetic to source-of-truth by
this ticket:** `useAnnotatePass.ts`'s `handleLongPressRemove` deletes a
photo from `usePhotoStore` without clearing the corresponding
`useBoundingBoxStore` keys, so `getBoxedPhotoIds` can return ids for
photos no longer in the pool. Out of scope for #172 — flagging per the
scope rule (pre-existing issue, not introduced here) rather than fixing
inline.

## Not yet done

Commit and PR not created this session. PR should target
`sprint/cat-annotate-flow` (not `main`), same as #170/#171 — override
`gh pr create`'s default base explicitly with `--base
sprint/cat-annotate-flow`.
