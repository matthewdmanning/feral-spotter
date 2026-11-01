# Project Structure

## Directory Layout

Feature-first. Migrated 2026-11-01 (plan:
[2026-11-01-feature-folder-migration.md](planning/2026-11-01-feature-folder-migration.md)).

```
src/
├── app/           # Expo Router routes — thin re-exports of screens only
├── providers/     # AppProviders (app layer)
├── features/
│   ├── auth/              # sign-in, Registration, auth providers, entry gate
│   ├── permissions/       # onboarding/ consent/ photo/ location/ communications/
│   ├── settings/          # settings screen + store, photo toggles
│   ├── draft-submission/  # the draft (ADR-0006), create/cats/Map picker screens, upload + cache
│   ├── camera-control/    # Camera screen and capture hooks (JS side of the Camera seam)
│   ├── library-picker/    # Library pick
│   ├── annotate/          # Box Annotation, Tutorial, inset crop bubble
│   └── history/           # Reports tab, Sighting detail
├── core/          # app-specific, too small to be a feature
│   ├── home/              # Home screen
│   └── location/          # Live fix (liveFix.ts) + its tuning
├── shared/        # domain-agnostic or cross-cutting kernel
│   ├── ui/{atoms,molecules,organisms}/   # Atomic Design UI kit
│   ├── analytics/  consent/  hooks/  lib/
│   └── config/  content/  types/  utils/
├── server-types/  # tsconfig.server.json includes it by path
└── test-utils/
```

Inside a feature or core unit: `screens/<route>/`, `components/`, `hooks/`
(hooks and zustand stores), `lib/`, `config/`. Only non-empty ones exist.
Tests sit in `__tests__/` beside their subject.

## Dependency rule

Non-screen code may import its own unit or a lower level. Peers on one level
never import each other.

| Level | Unit                                     |
| ----- | ---------------------------------------- |
| 0     | `shared/`                                |
| 1     | auth                                     |
| 2     | permissions                              |
| 3     | core                                     |
| 4     | settings                                 |
| 5     | draft-submission                         |
| 6     | camera-control, library-picker, annotate |
| 7     | history                                  |

- **Screens are the composition layer.** A `screens/` file may import any unit.
  Only `src/app/` and other screens import screens.
- No barrel (`index.ts` re-export) files: import the defining module. Metro
  bundles every re-export (#406), and barrels invite init-order cycles.
- No module-level import cycles.

`eslint.config.js` enforces all three for `@/` imports (`BOUNDARY_LEVELS`,
`import/no-cycle`). To move code, use `node scripts/move-module.mjs
<mapping-file>`: it runs `git mv` and rewrites import and `jest.mock`
specifiers.

Where new code goes: a piece two units need moves down to the lower one, or to
`shared/` when it is domain-agnostic.

## Native modules

Expo native modules live outside `src/`, one directory per module:

```
modules/
├── native-identification-camera/   # the camera session: CameraX and AVFoundation
│   ├── src/                        # the JavaScript half
│   │   ├── types.ts                # THE CONTRACT — props, events, ref methods
│   │   └── NativeIdentificationCameraView.tsx
│   ├── android/                    # Kotlin: ExpoView + CameraX
│   ├── ios/                        # Swift: ExpoView + AVFoundation
│   ├── index.ts                    # public surface, re-exports types
│   └── expo-module.config.json
└── ios-camera-optimizer/           # iOS-only device tuning, used by the legacy path
```

`src/` may import from `modules/`; `modules/` never imports from `src/`. The
same one-way rule applies.

`types.ts` is the camera seam's contract and both platforms implement it. Adding
a prop, an event or a ref method there obliges Kotlin and Swift equally, so keep
it narrow: platform tuning belongs inside each platform's own files, not in the
contract. Android's tuning table is `android/.../CaptureTuning.kt`; the iOS
equivalents are `ios/CaptureTuning.swift` and `ios/CameraExposurePolicy.swift`.

## What is verified where

Kotlin and Swift are not covered by the JavaScript checks. `npx tsc`, `npx
eslint` and `npx jest` say nothing about either. Kotlin has a local compile
(`cd android && ./gradlew :native-identification-camera:compileDebugKotlin`);
Swift has no compile check at all on the current plan, because it needs a macOS
runner. Report a Swift change as "needs test drive", never as verified.
