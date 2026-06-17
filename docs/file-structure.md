# FeralSpotter — File Structure

## Conforms to: dev.to/sachinrupani + Atomic Design

Output filename → destination path in project.

---

src/
│
├── app/                                    ← Expo Router — routing only, zero logic
│   ├── _layout.tsx                         ← Root Stack + AppProviders wrapper
│   │
│   ├── (home-tabs)/                        ← Tab group — screens that belong in tabs
│   │   ├── feral-reports.tsx
│   │   ├──_settings.tsx                      ← Tabs navigator (Home, Reports, Settings)
│   │   ├── index.tsx
│   │   └──_layout.tsx
│   │
│   ├── camera.tsx                          ← fullScreenModal — outside tabs
│   └── submission/
│       ├── annotate.tsx                     ← Nested Stack (3 steps + annotate modal)
│       ├── cats.tsx
│       ├── create.tsx
│       ├── photos.tsx

├── components/                             ← Atomic Design
│   │
│   ├── atoms/                              ← Smallest. Zero own-component dependencies.
│   │   ├── AppButton.styles.ts
│   │   ├── AppButton.tsx
│   │   ├── CameraThumb.styles.ts
│   │   ├── CameraThumb.tsx
│   │   ├── ErrorBoundary.styles.ts
│   │   ├── ErrorBoundary.tsx
│   │   ├── SegmentedControl.styles.ts
│   │   ├── SegmentedControl.tsx
│   │   ├── StatusIcon.styles.ts
│   │   └── StatusIcon.tsx
│   │
│   ├── molecules/
│   │   ├── AddAnotherCatDialog.styles.ts
│   │   ├── AddAnotherCatDialog.tsx
│   │   ├── BottomButtonColumn.styles.ts
│   │   ├── BottomButtonColumn.tsx
│   │   ├── PhotoPreviewModal.styles.ts
│   │   ├── PhotoPreviewModal.tsx
│   │   └── ReportCard.styles.ts
│   │   └── ReportCard.tsx
│   │   └── SignInPrompt.styles.ts
│   │   └── SignInPrompt.tsx
│   │
│   ├── organisms/                          ← Complex sections. Composed of molecules/atoms.
│       ├── AnnotateCarouselItem.styles.ts
│       ├── AnnotateCarouselItem.tsx
│       ├── CatForm.styles.ts
│       ├── CatForm.tsx
│       ├── CatPhotoSelector.styles.ts
│       ├── CatPhotoSelector.tsx
│       ├── DateTimePicker.styles.ts
│       ├── DateTimePicker.tsx
│       └── ValidationSheet.styles.ts
│       └── ValidationSheet.tsx
│
├── hooks/
│   ├── useAnnotateStateMachine.ts
│   ├── useBoundingBoxDraw.ts
│   ├── useBoundingBoxStore.ts
│   ├── useCameraCapture.ts
│   ├── useCatForm.ts
│   ├── useCatSubmit.ts
│   ├── useDateTimePicker.ts
│   ├── useFeralReports.ts
│   ├── usePhotoSession.ts
│   └── useSettingsDraft.ts
│
├── lib/                                    ← App brain — backend, cache, analytics
│   │                                         NOT pure logic (has side effects / IO)
│   ├── analytics/
│   │   └── analytics.ts                    ← IS_PRERELEASE re-exported from config/constants
│   ├── cache/
│   │   ├── storage.ts                      ← MMKV instance + Zustand adapter
│   │   └── submissionCache.ts              ← Per-submission MMKV cache CRUD
│   └── backend/                            [structure ready — populate with API client]
│       └── (api.ts moves here from utils/)
│
├── providers/                              ← Theme, query, safe area, global context
│   └── AppProviders.tsx                    ← SafeAreaProvider + PostHogProvider (IS_PRERELEASE gated) + ErrorBoundary
│       └──_layout.tsx
│
├── screens/                                ← UI + screen-level state
│   │                                         No authenticated/ — no auth flow
│   ├── camera/
│   │   ├── index.styles.ts
│   │   └── index.tsx
│   ├── feralReports/
│   │   ├── index.styles.ts
│   │   └── index.tsx
│   ├── home/
│   │   ├── index.styles.ts
│   │   └── index.tsx
│   ├── register/
│   │   ├── index.styles.ts
│   │   └── index.tsx
│   ├── settings/
│   │   ├── index.styles.ts
│   │   └── index.tsx
│   └── submission/
│       ├── annotate/
│       │   ├── index.styles.ts
│       │   └── index.tsx
│       ├── cats/
│       │   ├── index.styles.ts
│       │   └── index.tsx
│       │   └── constants.ts
│       ├── create/
│       │   ├── index.styles.ts
│       │   └── index.tsx
│       └── photos/
│       │   ├── index.styles.ts
│       │   └── index.tsx
││
├── types/
│   └── BoundingBox.ts
│
├── config/                                 ← App-wide constants and feature flags
│   └── constants.ts                        ← IS_PRERELEASE, APP_VERSION, autosave timing, MAX_PHOTOS
│
└── utils/                                  ← Pure logic only. Zero React dependency.
    ├── formatDateTime.ts                   ← utils_formatDateTime.ts

---

## Navigation Flow

app/_layout.tsx (Root Stack)
│
├── (home-tabs)/_layout.tsx  ← Tab navigator
│   ├── index            →  screens/home
│   ├── feral-reports    →  screens/feralReports
│   └── settings         →  screens/settings
│
├── camera               →  screens/camera       [fullScreenModal]
│
└── submission/_layout.tsx  ← Nested Stack
    ├── create           →  screens/submission/create
    ├── cats             →  screens/submission/cats
    ├── photos           →  screens/submission/photos
    └── annotate         →  screens/submission/annotate  [fullScreenModal]

## Dependency Direction

app/          → screens/ (thin re-exports only)
screens/      → hooks/ + components/ + lib/ + utils/
hooks/        → lib/ + utils/ + types/
components/   → atoms ← molecules ← organisms (upward only)
lib/          → config/ + types/
utils/        → (no src/ deps — pure)
config/       → (no src/ deps — pure)
providers/    → components/organisms/ + lib/

## Atomic Design Classification

| Component | Class | Reason |
|---|---|---|
| AppButton | Atom | No own-component deps |
| CameraThumb | Atom | No own-component deps |
| SegmentedControl | Atom | No own-component deps |
| StatusIcon | Atom | No own-component deps |
| ErrorBoundary | Atom | Distinct fallback section |
| AddAnotherCatDialog | Molecule | Single responsibility, atoms only |
| BottomButtonColumn | Molecule | Button list, single responsibility |
| PhotoPreviewModal | Molecule | Single responsibility, atoms only |
| ReportCard | Molecule | Uses StatusIcon atom |
| CatForm | Organism | 8× SegmentedControl + CatPhotoSelector |
| CatPhotoSelector | Organism | Distinct functional section |
| DateTimePicker | Organism | Platform-branched complex section |
| ValidationSheet | Organism | Bottom sheet, distinct UI section |
