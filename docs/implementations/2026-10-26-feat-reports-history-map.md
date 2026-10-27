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
- [x] Pin press or Reports card press → read-only Sighting view; answers as text, no selectors.
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

- **Decision:** `ownReports(caches, uid)` keeps rows with `user_id == uid` or no `user_id` (legacy rows, unsent drafts); drops other accounts' rows on a shared device.

### Spots and pins

- **Decision:** greedy grouping, newest first, anchored on first member, radius 30 m (`SPOT_RADIUS_M`). Badge = sum of cats across the spot's Sightings.
- **Reason:** anchor (not centroid) stops chains of near points merging into one pin.
- **Android:** baked bitmaps; Google Maps markers take an image, not a view. Generator: `scripts/generate-cat-pins.py` (Pillow + Nunito ExtraBold). Light-theme tokens; map tiles are light in both themes.
- **iOS:** Apple Maps markers take no custom image. 1 cat → SF Symbol `cat.fill`; >1 → count as `monogram` (iOS 17+). Marker press needs iOS 18+ (expo-maps).
- **Camera:** `mapViewForSpots` fits all pins; zoom from wider span, lat span ×2 (map ≈ half as tall as wide), clamp 3–16, single spot → 15.

### Read-only view

- **Decision:** route `/report/[id]`, title "Sighting". Rows from `describeSighting` (status, time source, coordinates, location source, accuracy, address, counts) and `describeCat` (8 attributes). Time = `manual_time` ?? `captured_at` ?? `created_at`.
- **`describeCat`/`summarizeCat`:** input widened to `CatAttributeValues` so history `CachedCat` reuses them.

## What shipped

- `src/lib/submission/profilePhoto.ts` — `resolveProfileBox`, `toCachedCat`.
- `src/lib/reports/history.ts` — `ownReports`, `groupReportsBySpot`, `pinBadge`, `mapViewForSpots`, `profilePicUri`, `sightingTime`, `describeSighting`.
- `src/lib/cache/submissionCache.ts` — `CachedPhoto`, `CachedProfileBox`; new optional fields. No migration: all optional.
- `src/hooks/useSubmissionSubmit.ts` — writes the above at Submit; payload `profile_photo_local_id`.
- `src/hooks/useCatForm.ts`, `useCatSubmit.ts` — `profilePhotoId` state → `ObservedCat.profile_photo_local_id`.
- `src/hooks/useFeralReports.ts` — uid scope, `spots`, silent re-read on tab focus (REPORTS_VIEWED stays mount/refresh only); `useReport(id)`.
- `src/components/atoms/CatCrop.tsx` — box crop via `bubbleImageRect`; glyph fallback on missing/failed image.
- `src/components/molecules/ProfilePicPicker.tsx` — Cat Form chooser.
- `src/components/molecules/ReportCard.tsx` — pressable; shows Sighting time.
- `src/components/organisms/ReportsMap.tsx` — map + pins.
- `src/screens/reportDetail/`, `src/app/report/[id].tsx`, root Stack entry.
- `src/types/assets.d.ts` — `*.png` module type (expo-env.d.ts is gitignored, absent in CI).
- `assets/images/catPins/` — 10 icons × 1x/2x/3x.

## Tests

| Test file                                               | What it verifies                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/submission/__tests__/profilePhoto.test.ts`     | Chosen box wins; stale/absent choice → first box; no box → none; cached crop survives teardown           |
| `src/lib/reports/__tests__/history.test.ts`             | Spot merge + cat sum; no chaining; badge thresholds; zoom fit; uid scope; cloud-before-local Profile Pic |
| `src/lib/submission/__tests__/payload.test.ts` (edited) | Cache metadata now carries Submission location                                                           |

**Not tested:** screen rendering of map/detail/picker — layout only, no state logic beyond the tested rules.

## Verification status

**Run and passing:**

- [x] `npm run typecheck` (`tsc --noEmit`)
- [x] `npx jest` — 88 suites, 406 tests
- [x] `npx eslint` on changed paths — 0 errors (2 pre-existing warnings, untouched files)
- [x] `scripts/format-staged.mjs`; pre-push prettier gate passed

**Unverified:**

- No device/emulator drive. Map render, pin bitmaps, marker press, crop framing all need an Android drive.
- iOS: needs test drive (monogram iOS 17+, marker press iOS 18+).
- `gitleaks` pre-commit hook not run: binary unavailable in the build sandbox.

## Follow-ups and known limitations

- [ ] Rows submitted before this branch have no coordinates or Profile Pic: off the map; glyph instead of photo.
- [ ] Inset-crop bubble still shows first box, not the chosen Profile Pic.
- [ ] Multi-Sighting pin opens newest only.
- [ ] "Profile Pic" not yet in `docs/agents/domain.md` glossary — candidate for /domain-modeling.
- [ ] No `ui-ux/current-state/` file for Reports map or Sighting view; needs owner confirmation before writing.
