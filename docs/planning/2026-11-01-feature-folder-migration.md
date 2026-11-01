# Feature-folder migration plan

Last updated: 2026-11-01. Status: **proposed** — open decisions in §8 block Phase 1.

Goal: replace the layer-first `src/` (`screens/ components/ hooks/ lib/`) with
feature-first `src/features/<feature>/` plus `src/shared/`. Pure moves; zero
behavior change.

Requested features: auth, camera-control (assumed meaning of "xanera-control";
§8 D1), library-picker, history, annotate, permissions (photo, location,
communications), settings. Shared: analytics.

## 1. Why the current layout leaks

`docs/PROJECT_STRUCTURE.md` mandates `app → screens → hooks/components/lib →
utils/config`. Code already violates it:

| Violation                   | Example                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| lib → hooks                 | `lib/analytics`, `lib/location`, `lib/submission/{draft,payload,profilePhoto}`, `lib/cats/attributes` import stores/hooks |
| components → screens        | `organisms/CatForm` → `screens/submission/cats/constants`                                                                 |
| hooks → components          | `useCapturedPhotoWorkflow` → `atoms/CameraThumb`                                                                          |
| components → hooks (stores) | `InsetCropBubble`, `AnnotateCarouselItem`, `ProfilePicPicker`, `PhotoDraftNotice`                                         |

Most dissolve once caller and callee share a feature folder. The rest are
resolved explicitly in §4.

## 2. Target layout

```
src/
├── app/            # Expo Router routes — unchanged; re-export paths updated only
├── features/
│   └── <feature>/
│       ├── screens/     # route-level components (+ .styles.ts)
│       ├── components/  # feature-only UI
│       ├── hooks/       # hooks + zustand stores
│       ├── lib/         # pure / service logic
│       ├── config/      # feature-only constants
│       └── index.ts     # public API — hooks, stores, types, lib; NOT screens
├── shared/
│   ├── ui/{atoms,molecules,organisms}/
│   ├── analytics/
│   ├── consent/     # consent *state* (store + step order), not consent screens
│   ├── hooks/       # useUIStore, useBackHandler, confirmExitApp
│   └── lib/         # cache/storage, haptics, appearance
├── config/ types/ utils/ providers/ server-types/ test-utils/   # unchanged (§8 D5)
```

Tests stay colocated in `__tests__/` beside their subject and move with it.
Subfolders appear only when non-empty.

## 3. File map

Paths relative to `src/`. `→ f/X` = `features/X/`; `→ s/` = `shared/`.

### shared

| From                                                                                                                                           | To                |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `components/atoms/{AmbientBackground,AppButton,ErrorBoundary,GlassSurface,HierarchicalSegmentedControl,SegmentedControl,TextButton,TextField}` | `s/ui/atoms/`     |
| `components/molecules/{BottomButtonColumn,ButtonRow,FieldRow,GateScreen,ToggleRow}`                                                            | `s/ui/molecules/` |
| `components/organisms/{AlertHost,dialogShell.styles}`                                                                                          | `s/ui/organisms/` |
| `lib/analytics/analytics.ts` (minus `fireAnalyticsEvent`, §4 E2)                                                                               | `s/analytics/`    |
| `hooks/{useConsentStore,consentFlow}`                                                                                                          | `s/consent/`      |
| `hooks/{useUIStore,useBackHandler,confirmExitApp}`                                                                                             | `s/hooks/`        |
| `lib/cache/storage.ts`, `lib/haptics.ts`, `lib/appearance.ts`                                                                                  | `s/lib/`          |

### f/auth

`screens/{sign-in,register}`, `lib/auth/*`, `hooks/useChangeEmail`.

### f/permissions

| Sub-area          | Files                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `consent/`        | `screens/{consent,dataAgreement,analytics-consent}`, `hooks/useConsentPermissions`, `organisms/ConsentChoiceScreen`, `molecules/DisclosureText`, `content/consentDisclosure.json` |
| `photo/`          | `lib/permissions/{cameraPermission,libraryPermission,gallerySavePermission}`                                                                                                      |
| `location/`       | `lib/permissions/locationPermission`, `lib/location.ts` (Live fix), `config/location.ts` (§8 D3)                                                                                  |
| `communications/` | `screens/email-opt-in`, `hooks/saveEmailOptIn`, `lib/email/syncEmailSubscription`                                                                                                 |
| root              | `lib/permissions/types.ts`                                                                                                                                                        |

Camera permission sits under `photo/` (camera captures photos).

### f/settings

`screens/settings`, `hooks/{useSettingsStore,useSettingsDraft}`, `config/photoToggles.ts`.

### f/draft (new, unlisted — §8 D2)

The ADR-0006 draft boundary: four stores and their single teardown owner.
`hooks/{usePhotoStore,useSubmissionStore,useBoundingBoxStore,useActiveCatFlowStore,useActiveCatFlow,useDraftStartupStore,useDraftSync,useResumableDraft,confirmResetSubmission}`,
`lib/submission/*`, `lib/upload/*`, `lib/cache/submissionCache.ts`,
`lib/camera/capturedPhotoFiles.ts` (§4 E3), `lib/annotate/catColors.ts` (§4 E4),
`utils/buildSubmissionPhoto.ts`.

### f/camera-control

`screens/camera/*`, `hooks/{useCameraCapture,useNativeCameraCapture,useIosIdentificationCapture,useCapturedPhotoWorkflow}`,
`lib/camera/pipeline.ts`, `atoms/CameraThumb{,.constants,.styles}`.
Camera seam stays in `modules/native-identification-camera/`; unchanged.

### f/library-picker

`hooks/useLibraryPhotoPicker`. (`utils/libraryPickTime` stays: `draft/payload` uses it.)

### f/annotate

`screens/submission/annotate/*`, `organisms/{AnnotateCarouselItem,InsetCropBubble,TutorialOverlay}`,
`atoms/CatCrop`, `hooks/{useAnnotatePass,useAnnotationTutorial,useTutorialStore,useBoundingBoxFrame}`,
`lib/annotate/{boxResize,cropProjection,panClamp,previousBoxes}`, `lib/insetCrop/*`, `config/tutorial.ts`.

### f/submission (new, unlisted — §8 D2)

`screens/submission/{create,cats,location-picker}`, `hooks/{useCatForm,useCatSubmit,useRemoveCat,useAbandonCatGuard,useSubmissionSubmit,useDateTimePicker}`,
`organisms/{CatForm,DateTimePicker}`, `molecules/ProfilePicPicker`, `lib/cats/attributes.ts`.

### f/history

`screens/{feralReports,sightingDetail}`, `hooks/{useFeralReports,useSighting}`,
`lib/sightings/history.ts`, `molecules/ReportCard`, `organisms/SightingsMap`, `atoms/StatusIcon`.

### f/home, f/onboarding (new, unlisted — §8 D2)

- home: `screens/home`, `hooks/useEntryGate`, `lib/home/entrypointDiameter`, `molecules/PhotoDraftNotice`.
- onboarding: `screens/intro-flow`, `config/introFlowCopy.ts`.

### Unmoved

`app/`, `providers/`, `types/`, `utils/` (except `buildSubmissionPhoto`),
`config/{constants,unistyles,themes,tabIcons.json}`, `server-types/`, `test-utils/`.

### Root `__tests__/`

`__tests__/components/atoms/StatusIcon.test.tsx` → `f/history/components/__tests__/`;
`__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts` → `f/submission/hooks/__tests__/`.
`RootLayout.startup.test.tsx` and `rules/` stay.

## 4. Dependency rule

Features form a DAG. Each level may import only lower levels.

| Level | Unit                                                                    |
| ----- | ----------------------------------------------------------------------- |
| 0     | `shared/`, `config/`, `types/`, `utils/`                                |
| 1     | auth                                                                    |
| 2     | permissions                                                             |
| 3     | settings                                                                |
| 4     | draft                                                                   |
| 5     | camera-control, library-picker, annotate (peers; no edges between them) |
| 6     | submission                                                              |
| 7     | history                                                                 |
| 8     | home, onboarding                                                        |

Rules:

1. Cross-feature imports go through `features/X/index.ts` only.
2. `app/` routes deep-import `features/X/screens/Y` (screens stay out of
   barrels so Metro does not eagerly load every screen; cf. #406).
3. `shared/` never imports `features/`.
4. Inside a feature, any direction is allowed; module-level cycles are not.

Back edges found in today's graph, and their fixes:

| #   | Edge                                                              | Fix                                                                                                                                                                 |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | auth screens → `consentFlow`; permissions/communications → auth   | Consent state (`useConsentStore`, `consentFlow`) → `shared/consent/`. 14 non-test modules across 5 features plus analytics and providers read it — a shared kernel. |
| E2  | `shared/analytics` → history (`sightingPhotoCount`), draft (type) | Move `fireAnalyticsEvent(cache)` into `f/history`; shared keeps `captureEvent`. Consent read becomes `shared/consent` (E1).                                         |
| E3  | draft (`usePhotoStore`) → camera (`capturedPhotoFiles`)           | `capturedPhotoFiles` → `f/draft` (photo-file lifecycle of the draft).                                                                                               |
| E4  | draft (`useBoundingBoxStore`) → annotate (`catColors`)            | `catColors` → `f/draft`.                                                                                                                                            |

## 5. Phases

One PR per phase. Each PR: `git mv` only plus import rewrites — no logic edits
except E1–E4. Checks per PR: `npm run typecheck`, `npm run lint`, `npx jest`,
`npm run format:check`, plus one Metro bundle (`npx expo export --platform android`)
since Jest's resolver is not Metro's.

| Phase | Scope                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | ADR-0008 (feature folders + DAG). Move script `scripts/move-module.mjs` (§6). Boundary lint rules at `warn`. Delete `hooks/index.ts` barrel: rewrite its ~10 importers and 5 `jest.mock('@/src/hooks')` calls to direct paths. |
| 1     | `shared/` moves + E1 + E2.                                                                                                                                                                                                     |
| 2     | auth, permissions, settings.                                                                                                                                                                                                   |
| 3     | draft + E3 + E4. Amend ADR-0006's `src/lib/submission/draft.ts` path.                                                                                                                                                          |
| 4     | camera-control, library-picker, annotate.                                                                                                                                                                                      |
| 5     | submission, history.                                                                                                                                                                                                           |
| 6     | home, onboarding. Remove empty `screens/ components/ hooks/ lib/ content/`. Boundary lint → `error`.                                                                                                                           |
| 7     | Docs sweep (§7).                                                                                                                                                                                                               |

Bottom-up order keeps every intermediate commit green: a moved module's
importers are rewritten in the same commit.

## 6. Tooling

**Move script.** Input: `from → to` pairs. Does `git mv`, then rewrites every
string literal equal to the old specifier in `src/`, `__tests__/`, `modules/`:
`import`/`export from`, `jest.mock(...)`, `jest.requireActual(...)`,
`require(...)`. Relative sibling imports (`./X.styles`) survive because
siblings move together; the script rewrites relative paths that cross the move
boundary to `@/src/...`.

Hazard: a stale `jest.mock` path that still resolves mocks the wrong module and
the test may pass vacuously. Guard: after each phase, grep every `jest.mock('@/src/...')`
target and assert the file exists; assert per-file test counts unchanged
(`npx jest --listTests` + `--json` diff before/after).

**Boundary lint.** No new dependency: generated per-feature blocks in
`eslint.config.js` using `@typescript-eslint/no-restricted-imports` `patterns`
— ban `@/src/features/*/**` deep paths outside the owning feature (except
`screens/` from `src/app/`), ban higher-level features per §4, ban
`@/src/features/**` from `src/shared/**`. Cycle check: `import/no-cycle` if the
expo config ships `eslint-plugin-import`, else `npx madge --circular` in CI —
verify which in Phase 0.

## 7. Non-code references to update

| Where                                                                 | What                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `eslint.config.js`                                                    | `react-hooks/immutability` override file list (3 paths)                |
| `scripts/format-shared.mjs`                                           | 2 `src/components/atoms/*.styles.ts` paths                             |
| `functions/src/index.ts`                                              | comments naming `src/lib/upload/firebaseUpload.ts`                     |
| `docs/PROJECT_STRUCTURE.md`                                           | rewrite to §2 + §4                                                     |
| `docs/agents/domain.md`                                               | code paths in Box Annotation, Camera screen, Observed Cat entries      |
| `docs/agents/ui-ux/current-state/*.md`                                | `governs:` frontmatter (staleness audit reads these)                   |
| `docs/agents/{backend,native-code,testing}.md`, other live agent docs | path mentions                                                          |
| `docs/adr/0006`, other ADRs naming paths                              | dated amendment line, not rewrite                                      |
| `docs/implementations/`, `planning/`, `test-drives/`                  | **not rewritten** — historical. ADR-0008 carries the old→new path map. |

Scale: ~1,775 `src/{hooks,lib,screens,components}/` mentions across 104 doc
files; 81 of those files are historical (implementations, planning, test-drives).

## 8. Open decisions (load-bearing)

| ID  | Question                                                                                                     | Proposed default                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| D1  | Does "xanera-control" mean camera-control? No `xanera` exists in the repo.                                   | Yes → `features/camera-control/`                                                               |
| D2  | Unlisted areas need homes: draft core, submission screens (create, cats, location-picker), home, onboarding. | Four extra features as in §3                                                                   |
| D3  | Live fix (`lib/location.ts`) under permissions/location or under draft?                                      | permissions/location (with the permission it depends on)                                       |
| D4  | Feature public API: `index.ts` barrel or deep imports with a lint allowlist?                                 | Barrel, screens excluded                                                                       |
| D5  | Move `config/ types/ utils/` under `shared/`?                                                                | No — already bottom layer; avoids churn of `src/config/unistyles.ts`, referenced by agent docs |

## 9. Risks

- **Merge conflicts** with in-flight branches: each phase touches many files.
  Land phases fast; announce freeze windows per phase.
- **Metro vs Jest resolution** differ; the per-phase `expo export` catches
  Metro-only breaks.
- **Native code**: `modules/` never imports `src/`; unaffected. No Kotlin or
  Swift change, so no device drive required beyond one smoke launch at Phase 6.
- **Git history**: `git mv` per file keeps `git log --follow` working; avoid
  mixing moves and edits in one file per commit (rename detection).
