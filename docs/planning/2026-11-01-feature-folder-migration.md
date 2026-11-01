# Feature-folder migration plan

Last updated: 2026-11-01. Status: **accepted decisions D1–D5** (§8); ready for Phase 0.

Goal: replace the layer-first `src/` (`screens/ components/ hooks/ lib/`) with
`src/features/<feature>/`, `src/core/` and `src/shared/`. Pure moves; zero
behavior change.

Features: auth, camera-control, library-picker, history, annotate,
permissions (onboarding, consent, photo, location, communications), settings,
draft-submission. Core: home, GPS (Live fix). Shared: analytics, UI kit,
foundations.

## 1. Why the current layout leaks

`docs/PROJECT_STRUCTURE.md` mandates `app → screens → hooks/components/lib →
utils/config`. Code already violates it:

| Violation                   | Example                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| lib → hooks                 | `lib/analytics`, `lib/location`, `lib/submission/{draft,payload,profilePhoto}`, `lib/cats/attributes` import stores/hooks |
| components → screens        | `organisms/CatForm` → `screens/submission/cats/constants`                                                                 |
| hooks → components          | `useCapturedPhotoWorkflow` → `atoms/CameraThumb`                                                                          |
| components → hooks (stores) | `InsetCropBubble`, `AnnotateCarouselItem`, `ProfilePicPicker`, `PhotoDraftNotice`                                         |

Most dissolve once caller and callee share a folder. The rest are resolved in
§4.

## 2. Target layout

```
src/
├── app/            # Expo Router routes — unchanged; re-export paths updated only
├── providers/      # AppProviders — app layer, unchanged
├── features/
│   └── <feature>/
│       ├── screens/     # route-level components (+ .styles.ts)
│       ├── components/  # feature-only UI
│       ├── hooks/       # hooks + zustand stores
│       ├── lib/         # pure / service logic
│       └── config/      # feature-only constants
├── core/           # app-specific, too small to be a feature
│   ├── home/
│   └── location/   # Live fix
├── shared/         # domain-agnostic or cross-cutting kernel
│   ├── ui/{atoms,molecules,organisms}/
│   ├── analytics/
│   ├── consent/    # consent *state* (store + step order), not consent screens
│   ├── hooks/      # useUIStore, useBackHandler, confirmExitApp
│   ├── lib/        # cache/storage, haptics, appearance
│   ├── config/     # was src/config/
│   ├── content/    # was src/content/
│   ├── types/      # was src/types/
│   └── utils/      # was src/utils/
├── server-types/   # unchanged — tsconfig.server.json includes it by path
└── test-utils/     # unchanged
```

No `index.ts` barrels (D4). Tests stay colocated in `__tests__/` beside their
subject and move with it. Subfolders appear only when non-empty.

## 3. File map

Paths relative to `src/`. `f/X` = `features/X/`; `c/` = `core/`; `s/` = `shared/`.

### shared

| From                                                                                                                                                   | To                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `components/atoms/{AmbientBackground,AppButton,CatCrop,ErrorBoundary,GlassSurface,HierarchicalSegmentedControl,SegmentedControl,TextButton,TextField}` | `s/ui/atoms/`                     |
| `components/molecules/{BottomButtonColumn,ButtonRow,FieldRow,GateScreen,ToggleRow}`                                                                    | `s/ui/molecules/`                 |
| `components/organisms/{AlertHost,dialogShell.styles}`                                                                                                  | `s/ui/organisms/`                 |
| `lib/annotate/cropProjection.ts`, `lib/insetCrop/imageRect.ts` (pure geometry; `CatCrop` needs them, §4 E5)                                            | `s/lib/geometry/`                 |
| `lib/analytics/analytics.ts` (minus `fireAnalyticsEvent`, §4 E2)                                                                                       | `s/analytics/`                    |
| `hooks/{useConsentStore,consentFlow}`                                                                                                                  | `s/consent/`                      |
| `hooks/{useUIStore,useBackHandler,confirmExitApp}`                                                                                                     | `s/hooks/`                        |
| `lib/cache/storage.ts`, `lib/haptics.ts`, `lib/appearance.ts`                                                                                          | `s/lib/`                          |
| `config/*` (except files claimed below), `content/*` (except consentDisclosure), `types/*`, `utils/*` (except `buildSubmissionPhoto`)                  | `s/{config,content,types,utils}/` |

### core

| From                                               | To            |
| -------------------------------------------------- | ------------- |
| `screens/home/*`, `lib/home/entrypointDiameter.ts` | `c/home/`     |
| `lib/location.ts` (Live fix), `config/location.ts` | `c/location/` |

### f/auth

`screens/{sign-in,register}`, `lib/auth/*`, `hooks/{useChangeEmail,useEntryGate}`.

### f/permissions

| Sub-area          | Files                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding/`     | `screens/intro-flow`, `config/introFlowCopy.ts`                                                                                                                                   |
| `consent/`        | `screens/{consent,dataAgreement,analytics-consent}`, `hooks/useConsentPermissions`, `organisms/ConsentChoiceScreen`, `molecules/DisclosureText`, `content/consentDisclosure.json` |
| `photo/`          | `lib/permissions/{cameraPermission,libraryPermission,gallerySavePermission}`                                                                                                      |
| `location/`       | `lib/permissions/locationPermission`                                                                                                                                              |
| `communications/` | `screens/email-opt-in`, `hooks/saveEmailOptIn`, `lib/email/syncEmailSubscription`                                                                                                 |
| root              | `lib/permissions/types.ts`                                                                                                                                                        |

Camera permission sits under `photo/` (camera captures photos).

### f/settings

`screens/settings`, `hooks/{useSettingsStore,useSettingsDraft}`, `config/photoToggles.ts`.

### f/draft-submission

One feature: the ADR-0006 draft (four stores, one teardown owner), the screens
that build it, and the backend calls that send it.

| Part    | Files                                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| screens | `screens/submission/{create,cats,location-picker}` (Map picker included)                                                                                                       |
| stores  | `hooks/{usePhotoStore,useSubmissionStore,useBoundingBoxStore,useActiveCatFlowStore,useDraftStartupStore}`                                                                      |
| hooks   | `hooks/{useActiveCatFlow,useDraftSync,useResumableDraft,confirmResetSubmission,useCatForm,useCatSubmit,useRemoveCat,useAbandonCatGuard,useSubmissionSubmit,useDateTimePicker}` |
| UI      | `organisms/{CatForm,DateTimePicker}`, `molecules/{ProfilePicPicker,PhotoDraftNotice}`                                                                                          |
| lib     | `lib/submission/*`, `lib/cats/attributes.ts`, `lib/camera/capturedPhotoFiles.ts` (§4 E3), `lib/annotate/catColors.ts` (§4 E4), `utils/buildSubmissionPhoto.ts`                 |
| backend | `lib/upload/{firebaseUpload,uploadNewPhoto}`, `lib/cache/submissionCache.ts`                                                                                                   |

Backend communication is a sub-folder (`lib/upload/`), not its own feature:
every upload today is a draft photo or draft metadata (ADR-0005).
`shared/utils/api.ts` stays shared (settings uses it).

### f/camera-control

`screens/camera/*`, `hooks/{useCameraCapture,useNativeCameraCapture,useIosIdentificationCapture,useCapturedPhotoWorkflow}`,
`lib/camera/pipeline.ts`, `atoms/CameraThumb{,.constants,.styles}`.
Camera seam stays in `modules/native-identification-camera/`; unchanged.

### f/library-picker

`hooks/useLibraryPhotoPicker`.

### f/annotate

`screens/submission/annotate/*`, `organisms/{AnnotateCarouselItem,InsetCropBubble,TutorialOverlay}`,
`hooks/{useAnnotatePass,useAnnotationTutorial,useTutorialStore,useBoundingBoxFrame}`,
`lib/annotate/{boxResize,panClamp,previousBoxes}`, `lib/insetCrop/{collapse,diameter}`, `config/tutorial.ts`.

### f/history

`screens/{feralReports,sightingDetail}`, `hooks/{useFeralReports,useSighting}`,
`lib/sightings/history.ts`, `molecules/ReportCard`, `organisms/SightingsMap`, `atoms/StatusIcon`.

### Root `__tests__/`

`__tests__/components/atoms/StatusIcon.test.tsx` → `f/history/components/__tests__/`;
`__tests__/hooks/useSubmissionSubmit.submitFlow.test.ts` → `f/draft-submission/hooks/__tests__/`.
`RootLayout.startup.test.tsx` and `rules/` stay.

## 4. Dependency rule

Non-screen code forms a DAG. Each level may import only its own level's
unit or lower levels.

| Level | Unit                                                                    |
| ----- | ----------------------------------------------------------------------- |
| 0     | `shared/`                                                               |
| 1     | auth                                                                    |
| 2     | permissions                                                             |
| 3     | core (`location/`; `home/` non-screen code)                             |
| 4     | settings                                                                |
| 5     | draft-submission                                                        |
| 6     | camera-control, library-picker, annotate (peers; no edges between them) |
| 7     | history                                                                 |

Rules:

1. **Screens are the composition layer.** Any `screens/` file may import any
   feature or core module. Only `src/app/` imports screens. Nothing imports a
   screen otherwise, so screen imports cannot form cycles.
2. All other code obeys the level table.
3. `shared/` never imports `core/` or `features/`.
4. No barrels: import the defining module directly (D4).
5. No module-level cycles anywhere.

Rule 1 lets `draft-submission` screens use library-picker ("add more photos")
and annotate (`InsetCropBubble`), and lets `core/home` use every entrypoint.

Back edges in today's non-screen graph, and their fixes:

| #   | Edge                                                                            | Fix                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | auth screens → `consentFlow`; permissions/communications → auth                 | Consent state (`useConsentStore`, `consentFlow`) → `shared/consent/`. 14 non-test modules across 5 features plus analytics and providers read it — a shared kernel. |
| E2  | `shared/analytics` → history (`sightingPhotoCount`), draft (type)               | Move `fireAnalyticsEvent(cache)` into `f/history`; shared keeps `captureEvent`. Consent read becomes `shared/consent` (E1).                                         |
| E3  | `usePhotoStore` → camera (`capturedPhotoFiles`)                                 | `capturedPhotoFiles` → `f/draft-submission` (photo-file lifecycle of the draft).                                                                                    |
| E4  | `useBoundingBoxStore` → annotate (`catColors`)                                  | `catColors` → `f/draft-submission`.                                                                                                                                 |
| E5  | `ProfilePicPicker` (draft-submission) → `CatCrop`; `sightingDetail` → `CatCrop` | `CatCrop` → `shared/ui`; its pure geometry deps → `shared/lib/geometry`.                                                                                            |
| E6  | `CatForm`, `useCatSubmit` → `screens/submission/cats/constants.ts`              | `constants.ts` → `f/draft-submission/config/catForm.ts` (non-screen code may not import `screens/`).                                                                |

## 5. Phases

One PR per phase. Each PR: `git mv` plus import rewrites — no logic edits
except E1–E6. Checks per PR: `npm run typecheck`, `npm run lint`, `npx jest`,
`npm run format:check`, plus one Metro bundle (`npx expo export --platform android`)
since Jest's resolver is not Metro's.

| Phase | Scope                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | ADR-0008 (feature folders + rules). Move script `scripts/move-module.mjs` (§6). Boundary lint at `warn`. Delete `hooks/index.ts` barrel: rewrite its 10 importers and 5 `jest.mock('@/src/hooks')` calls to direct paths. |
| 1     | `shared/` moves, including `config/ content/ types/ utils/` + E1 + E2 + E5.                                                                                                                                               |
| 2     | auth, permissions (incl. onboarding), core/location.                                                                                                                                                                      |
| 3     | settings, draft-submission + E3 + E4 + E6. Amend ADR-0006's `src/lib/submission/draft.ts` path.                                                                                                                           |
| 4     | camera-control, library-picker, annotate.                                                                                                                                                                                 |
| 5     | history, core/home. Remove empty `screens/ components/ hooks/ lib/`. Boundary lint → `error`.                                                                                                                             |
| 6     | Docs sweep (§7).                                                                                                                                                                                                          |

Bottom-up order keeps every intermediate commit green: a moved module's
importers are rewritten in the same commit.

## 6. Tooling

**Move script.** Input: `from → to` pairs. Does `git mv`, then rewrites every
string literal equal to the old specifier in `src/`, `__tests__/`, `modules/`,
`jest.setup.js`: `import`/`export from`, `jest.mock(...)`,
`jest.requireActual(...)`, `require(...)`. Relative sibling imports
(`./X.styles`) survive because siblings move together; the script rewrites
relative paths that cross the move boundary to `@/src/...`.

Hazard: a stale `jest.mock` path that still resolves mocks the wrong module and
the test may pass vacuously. Guard: after each phase, assert every
`jest.mock('@/src/...')` target exists; assert per-file test counts unchanged
(`npx jest --json` diff before/after).

**Boundary lint.** No new dependency: generated per-unit blocks in
`eslint.config.js` using `@typescript-eslint/no-restricted-imports` `patterns`
— ban higher levels per §4, ban `**/screens/**` outside `src/app/`, ban
`@/src/{core,features}/**` from `src/shared/**`, ban `index` barrels. Cycle
check: `import/no-cycle` if the expo config ships `eslint-plugin-import`, else
`npx madge --circular` in CI — verify in Phase 0.

## 7. Non-code references to update

| Where                                                                 | What                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `eslint.config.js`                                                    | `react-hooks/immutability` override file list (3 paths)                |
| `jest.setup.js`                                                       | `require('./src/config/themes')`                                       |
| `scripts/format-shared.mjs`                                           | 2 `src/components/atoms/*.styles.ts` paths                             |
| `scripts/generate-cat-pins.py`                                        | reads `src/config/themes.ts`                                           |
| `functions/src/index.ts`                                              | comments naming `src/lib/upload/firebaseUpload.ts`                     |
| `docs/PROJECT_STRUCTURE.md`                                           | rewrite to §2 + §4                                                     |
| `docs/agents/project_instructions.md`                                 | `src/config/unistyles.ts` → `src/shared/config/unistyles.ts`           |
| `docs/agents/domain.md`                                               | code paths in Box Annotation, Camera screen, Observed Cat entries      |
| `docs/agents/ui-ux/current-state/*.md`                                | `governs:` frontmatter (staleness audit reads these)                   |
| `docs/agents/{backend,native-code,testing}.md`, other live agent docs | path mentions                                                          |
| `docs/adr/0006`, other ADRs naming paths                              | dated amendment line, not rewrite                                      |
| `docs/implementations/`, `planning/`, `test-drives/`                  | **not rewritten** — historical. ADR-0008 carries the old→new path map. |

Scale: ~1,775 `src/{hooks,lib,screens,components}/` mentions across 104 doc
files; 81 of those files are historical (implementations, planning, test-drives).

## 8. Decisions (2026-11-01)

| ID  | Decision                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | "xanera-control" = camera-control.                                                                                                                                                                                |
| D2  | Onboarding is part of permissions. Home is core. Draft + submission screens + backend upload are one feature, `draft-submission`.                                                                                 |
| D3  | GPS (Live fix) is core, not a feature. The OS location-permission adapter stays in permissions/location.                                                                                                          |
| D4  | No barrel files; direct module imports. Reasons: Metro bundles every re-export (the #406 icon-barrel cost); barrels invite init-order cycles between features; existing deep-path `jest.mock` calls keep working. |
| D5  | `config/ content/ types/ utils/` move under `shared/` — one rule ("level 0 is `shared/`") instead of five top-level exceptions.                                                                                   |

`core/` vs `shared/`: `shared/` is domain-agnostic or a cross-cutting kernel
(UI kit, storage, analytics, consent state). `core/` is app-specific code too
small to be a feature (Home, Live fix).

## 9. Risks

- **Merge conflicts** with in-flight branches: each phase touches many files.
  Land phases fast; announce freeze windows per phase.
- **Metro vs Jest resolution** differ; the per-phase `expo export` catches
  Metro-only breaks.
- **Native code**: `modules/` never imports `src/`; unaffected. No Kotlin or
  Swift change, so no device drive required beyond one smoke launch at Phase 5.
- **Git history**: `git mv` per file keeps `git log --follow` working; avoid
  mixing moves and edits in one file per commit (rename detection).
