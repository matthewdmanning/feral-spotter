---
title: Reports history, map overview, and Profile Pic
tags:
  - implementation
---

# Reports history, map overview, and Profile Pic

**Scope:** feature
**Issues/spec:** user request 2026-10-26 (no issue)
**Date:** 2026-10-26
**Branch/PR:** `feat/reports-history-map`

## Scope

**In scope:**

- [x] Reports tab = signed-in user's personal Sighting history.
- [x] Map overview atop Reports: cat-head pin per spot; count badge bottom-right when >1 cat; 9+ cap.
- [x] Pin press or sent-Sighting card press → read-only Sighting view; answers as text, no selectors. Resumable In Progress card → resumes draft; abandoned draft card → not pressable.
- [x] Profile Pic per cat: user-chosen crop, else first box. Chooser in Cat Form. Sent in payload.

**Out of scope:**

- Cloud-synced history. History = this device's `submissionCache` rows only.
- Edit/delete from history.
- Pin chooser for multi-Sighting spots (opens newest; rest in list).

## Design decisions and reasoning

### History survives draft teardown

- **Decision:** Submit stores in the cache row: Submission location (`metadata.latitude/longitude/accuracy`), `photos[]` (`local_id`, `uri`, `cloud_storage_url`), `user_id`, per-cat `profile_box`.
- **Reason:** `completeDraft()` deletes camera files and wipes box store. Before this, a submitted row held no coordinates, no box, only dead `file://` links.
- **Profile Pic source order:** `cloud_storage_url` → local `uri` (survives for Library picks) → cat glyph.

### Profile Pic rule

- **Decision:** `resolveProfileBox(boxes, chosen)` = box on chosen photo, else first box (confirmation order). Stale choice (photo removed, box redrawn absent) falls back; never blank.
- **Reason:** one rule shared by Cat Form display and Submit, so starred = saved.
- **Where chosen:** Cat Form, row above attributes. Picker hidden at 0 boxes; non-interactive at 1. Clear resets attributes only, not Profile Pic.
- **Payload:** `cats[].profile_photo_local_id` (resolved). Additive; `storage.rules` validates size/type only.

### Personal scope

- **Decision:** `ownSightings(caches, uid)` keeps rows with `user_id == uid` or no `user_id` (legacy rows, unsent drafts); drops other accounts' rows on a shared device.

### Spots and pins

- **Decision:** greedy grouping, newest first, anchored on first member, radius 30 m (`SPOT_RADIUS_M`). Badge = sum of cats across the spot's Sightings.
- **Reason:** anchor (not centroid) stops chains of near points merging into one pin.
- **Android:** baked bitmaps; Google Maps markers take an image, not a view. Generator: `scripts/generate-cat-pins.py` (Pillow + Nunito ExtraBold). Map tiles are light in both themes: head/face from `lightTheme` accent pair; ears/badge/badge text from `darkTheme` pastels for contrast.
- **iOS:** Apple Maps markers take no custom image. 1 cat → SF Symbol `cat.fill`; >1 → count as `monogram` (iOS 17+). Marker press needs iOS 18+ (expo-maps).
- **Camera:** `mapViewForSpots(spots, measuredSize)` fits all pins: per-axis Web-Mercator zoom from measured frame dp (256-dp world tile at z0, latitude in Mercator y), smaller wins, 40% padding, clamp 3–16, single spot → 15. Camera object memoized on values, so a focus re-read does not reset a pan.
- **Scroll:** map touch pauses the Reports ScrollView (`onTouchActiveChange`), so pans move the map.
- **Android pins:** markers wait for bitmaps (no default-marker flash); load failure → default markers.
- **Generator:** reads colors from `themes.ts` and `MAX_BADGE_COUNT` from `history.ts`; nothing hardcoded.

### Read-only view

- **Decision:** route `/sighting/[id]`, title "Sighting". Header: Sighting time + status. Rows from `describeSighting` (time from, location = address ?? 4-decimal coords, location from, GPS accuracy, counts) in plain words, not method names; rows via `FieldRow` and `describeCat` (8 attributes). Time = `manual_time` ?? `captured_at` ?? `created_at`.
- **`describeCat`/`summarizeCat`:** input widened to `CatAttributeValues` so history `CachedCat` reuses them. `attributes.ts` moved `screens/submission/cats/` → `lib/cats/`: shared by two screens and hooks.

### Ordering and card press

- **Decision:** list and spot grouping sort by `sightingTime` (the time the card shows), not `created_at`.
- **Card press:** `sightingCardAction` — sent → view; In Progress and resumable (Home's rule: newest-created row, not stale) → resume; other In Progress → not pressable. Pressable cards show a caret.

### Photo count

- **Decision:** `photo_links` no longer written (`@deprecated`); `photos[]` replaces it. Readers (card, detail, analytics `photo_count`) use `sightingPhotoCount`, which falls back to `photo_links` for older rows.

### Profile Pic picker

- Same boxes as Submit (`getBoxesForCat` via `useShallow`), so starred = saved. Selected: cat-color border + star; unselected at full opacity (dimming read as disabled). One box: hint says box another photo to choose. Radiogroup + per-option labels.

## What shipped

- `src/lib/submission/profilePhoto.ts` — `resolveProfileBox`, `toCachedCat`.
- `src/lib/sightings/history.ts` — `ownSightings`, `sortBySightingTime`, `sightingPhotoCount`, `sightingCardAction`, `groupSightingsBySpot`, `pinBadge`, `mapViewForSpots`, `profilePicUri`, `sightingTime`, `describeSighting`.
- `src/lib/cats/attributes.ts` — moved from `src/screens/submission/cats/` (with its tests).
- `src/lib/cache/submissionCache.ts` — `CachedPhoto`, `CachedProfileBox`; new optional fields. No migration: all optional.
- `src/hooks/useSubmissionSubmit.ts` — writes the above at Submit; payload `profile_photo_local_id`.
- `src/hooks/useCatForm.ts`, `useCatSubmit.ts` — `profilePhotoId` state → `ObservedCat.profile_photo_local_id`.
- `src/hooks/useFeralReports.ts` — uid scope, Sighting-time order, `spots`, `resumableId`, silent re-read on tab focus (REPORTS_VIEWED stays mount/refresh only).
- `src/hooks/useSighting.ts` — one Sighting for the detail view.
- `src/config/themes.ts` — `borderWidth` (`frame`, `selected`) and `opacity.pressed` tokens.
- `src/components/atoms/CatCrop.tsx` — box crop via `bubbleImageRect`; glyph fallback on missing/failed image.
- `src/components/molecules/FieldRow.tsx` — label/value row; Submission Details and Sighting view.
- `src/components/molecules/ProfilePicPicker.tsx` — Cat Form chooser.
- `src/components/molecules/ReportCard.tsx` — view/resume/none per `sightingCardAction`; caret; shows Sighting time.
- `src/components/organisms/SightingsMap.tsx` — map + pins.
- `src/screens/sightingDetail/`, `src/app/sighting/[id].tsx`, root Stack entry.
- `src/test-utils/catFixtures.ts` — `observedCat()`; defaults read from `CAT_ATTRIBUTES`.
- `src/types/assets.d.ts` — `*.png` module type (expo-env.d.ts is gitignored, absent in CI).
- `assets/images/catPins/` — 10 icons × 1x/2x/3x.

## Tests

| Test file                                                                | What it verifies                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/submission/__tests__/profilePhoto.test.ts`                      | Chosen box wins; stale/absent choice → first box; no box → none; cached crop survives teardown                                                                                                            |
| `src/lib/sightings/__tests__/history.test.ts`                            | Spot merge + cat sum; exact no-chaining split; Sighting-time order; card action; badge thresholds; every pin inside wide and tall frames (incl. high latitude); uid scope; cloud-before-local Profile Pic |
| `src/lib/submission/__tests__/payload.test.ts` (edited)                  | Cache metadata now carries Submission location                                                                                                                                                            |
| `src/hooks/__tests__/useSubmissionSubmit.cacheSync.test.ts` (added case) | After real Submit + teardown, history row keeps owner, location, chosen Profile Pic crop, cloud URL                                                                                                       |

**Not tested:** screen rendering of map/detail/picker — layout only, no state logic beyond the tested rules.

## Verification status

**Run and passing:**

- [x] `npm run typecheck` (`tsc --noEmit`)
- [x] `npx jest` — 88 suites, 414 tests
- [x] `npx eslint` on changed paths — 0 errors (2 pre-existing warnings, untouched files)
- [x] `scripts/format-staged.mjs`; pre-push prettier gate passed

**Unverified:**

- No device/emulator drive. Map render, pin bitmaps, marker press, crop framing, map-touch scroll pause, star badge clipping all need an Android drive.
- iOS: needs test drive (monogram iOS 17+, marker press iOS 18+).
- `gitleaks` pre-commit hook not run: binary unavailable in the build sandbox.

## Follow-ups and known limitations

- [ ] Rows submitted before this branch have no coordinates or Profile Pic: off the map; glyph instead of photo.
- [ ] Inset-crop bubble still shows first box, not the chosen Profile Pic.
- [ ] Multi-Sighting pin opens newest only.
- [ ] "Profile Pic" not yet in `docs/agents/domain.md` glossary — candidate for /domain-modeling.
- [ ] No `ui-ux/current-state/` file for Reports map or Sighting view; needs owner confirmation before writing.
