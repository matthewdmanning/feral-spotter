---
title: RAW+JPEG Submission delivery
tags:
  - implementation
  - uploads
---

# RAW+JPEG Submission delivery

**Scope:** feature delivery and upload/cleanup contract
**Issues/spec:** #469, with native capture settlement from #470
**Date:** 2026-11-16
**Branch/PR:** `issue-468-camera-audit-fixes`

## Scope

**In scope:**

- [x] Upload the original DNG beside its JPEG using a stable slot path.
- [x] Keep pair state retryable until both artifacts succeed.
- [x] Link the pair in object metadata and `metadata.json`.
- [x] Preserve owner, slot, MIME, size, and cleanup rules.

**Out of scope / not addressed:**

- No ML/denoising service exists in this repository. A downstream consumer
  must read `photo_pairs`; organization sharing continues to project JPEGs
  only.
- No live Firebase deploy or device validation was run in this slice.

## Intent

**Purpose:** Make a native `RAW+JPEG` capture durable without transforming or
silently deleting the sensor-original DNG when a submission needs retrying.

## Design decisions and reasoning

### One slot, two objects

- **Decision:** `photo-N.<jpeg-extension>` remains the JPEG object and
  `photo-N.dng` is its paired DNG. DNGs do not consume another photo slot.
- **Reason:** The Storage rules' exact slot-name cap remains synchronous and
  exact while preserving the original bytes.

### Pair completion is atomic at the draft boundary

- **Decision:** The photo remains `uploaded: false` until both artifacts have
  completed. A prior JPEG-only persisted photo with `raw_uri` is migrated to
  the same retry path.
- **Reason:** Submit must not publish a JPEG-only payload when a RAW capture
  still has a local DNG, and a failed DNG must remain available for retry.

### Manifest and backend boundary

- **Decision:** JPEG paths stay in `photo_paths`; paired captures add
  `photo_pairs: [{ jpeg_path, dng_path }]`. Objects carry reciprocal
  `paired_dng_path` / `paired_jpeg_path` metadata.
- **Reason:** The existing organization API consumes `photo_paths`; adding an
  optional manifest preserves that contract and makes pair identity explicit.
  No ML ingestion service is present here.

## What shipped

- `SubmissionPhoto` and `PhotoUploadResponse` carry the paired DNG paths.
- Firebase upload code uses RNFirebase `putFile` metadata and preserves the
  local DNG on failure.
- Storage rules allow owner DNG objects only under `photo-0` … `photo-9`, with
  `image/x-adobe-dng` and a strict `<64 MiB` bound.
- Organization ingestion validates same-slot, same-prefix, unique pair
  entries; the metadata-bearing prefix remains protected from orphan cleanup.

## Tests

| Test file                                                                            | What it verifies                                           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `src/features/draft-submission/lib/upload/__tests__/firebaseUpload.behavior.test.ts` | Reciprocal metadata, DNG path/MIME, and legacy JPEG repair |
| `src/features/draft-submission/lib/upload/__tests__/draftUploads.test.ts`            | Failed DNG remains retryable; success completes the pair   |
| `src/features/draft-submission/lib/__tests__/payload.test.ts`                        | Pair manifest and no bogus DNG for JPEG-only               |
| `__tests__/rules/storage.test.ts`                                                    | Owner/type/path/size DNG rules                             |
| `__tests__/rules/submissionLayout.contract.test.ts`                                  | App DNG path and rules/functions layout agreement          |
| `functions/src/__tests__/index.test.ts`                                              | Sweep retains a metadata-bearing JPEG/DNG prefix           |
| `functions/src/organizations/emulator-tests/api.test.ts`                             | Valid pair ingestion and mismatched-slot rejection         |

## Verification status

**Run and passing:**

- [x] Type checking: `npm.cmd run typecheck`
- [x] Focused Jest tests: 34 tests across upload, payload, removal, and queue
      race suites.
- [x] Full app Jest suite: 122 suites, 554 tests.
- [x] Storage rules/layout emulator tests: 25 tests (`npm.cmd run test:rules`).
- [x] Functions unit/build tests: 63 unit tests plus `npm.cmd run build`;
      organization emulator: 15 tests.
- [x] Formatting: Prettier on the changed source, tests, and docs.
- [x] Lint: zero errors; three existing warnings in unchanged `BottomButtonColumn.tsx`.

**Unverified:**

- Native capture, physical device, live Firebase rules/deployment, and any
  external ML consumer.

## Graveyard: pivots and corrections

### Backend consumer boundary

- **Finding:** The repository has no ML/denoising ingestion service; only the
  organization API reads `metadata.json`.
- **Impact:** Adding a speculative backend or Firestore path would diverge from
  the project contract.
- **Resolution:** Keep the pair manifest in Storage metadata and validate it at
  the existing organization boundary; document external consumption honestly.

## Follow-ups and known limitations

- [ ] A future external ML pipeline must consume `photo_pairs` if it needs DNGs.
- [Known limitation] No device evidence exists for DNG byte size on every
  supported sensor; the 64 MiB rule is the documented bounded envelope.
