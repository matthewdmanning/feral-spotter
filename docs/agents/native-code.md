# Native code

Reference for Kotlin, Swift, Gradle and Xcode work in this repository. Read it
before you change any file under `modules/*/android/` or `modules/*/ios/`.

The one fact that governs everything else: **no JavaScript check in this repo
reads native code.** `npm run lint`, `npm test` and the prettier gate cannot
fail on a Kotlin or Swift mistake. A compile is the only check you have.

---

## 1. Where native code lives

| Path                                                                | Tracked            | Edit it?                                           |
| ------------------------------------------------------------------- | ------------------ | -------------------------------------------------- |
| `modules/native-identification-camera/android/src/main/java/…/*.kt` | yes                | yes — this is the source                           |
| `modules/native-identification-camera/ios/*.swift`                  | yes                | yes — this is the source                           |
| `modules/ios-camera-optimizer/ios/*.swift`                          | yes                | yes — this is the source                           |
| `modules/*/android/build.gradle`, `modules/*/ios/*.podspec`         | yes                | yes, with care                                     |
| `modules/*/src/*.ts`                                                | yes                | yes — the shared contract both platforms implement |
| `android/`                                                          | **no**, gitignored | **never** — `expo prebuild` regenerates it         |
| `ios/`                                                              | **no**, gitignored | **never** — `expo prebuild` regenerates it         |
| `modules/*/android/build/`                                          | no                 | never — Gradle output                              |

`android/` and `ios/` are build output, not source. An edit there is lost at the
next prebuild and cannot be committed. If a change seems to belong in `android/`,
it belongs in `app.config`, a config plugin, or the module instead. Stop and ask.

`ios/` does not exist in a fresh checkout. It appears only after `expo prebuild`
on a Mac. Do not report its absence as a fault.

---

## 2. Which skill to load

Load the skill before you write code, not after the code fails. Prefer the skill
over your own recollection of an API: these libraries change between versions,
and the skills carry the version this repo pins.

| You are writing                                                               | Load                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Any Expo module — a view, a prop, an event, a lifecycle hook                  | `expo-module`                                                                        |
| CameraX — `ProcessCameraProvider`, `Preview`, `ImageCapture`, `SessionConfig` | `camerax` **and** `expo-module`                                                      |
| Xcode project settings, signing, schemes, build phases                        | `xcode-project-setup`                                                                |
| Dev-client behaviour, native debugging on device                              | `expo-dev-client`                                                                    |
| Native UI on either platform                                                  | `expo-native-ui`, or `expo-ui` for SwiftUI/Compose                                   |
| Firebase native SDK wiring                                                    | the matching `firebase-*` skill; see [backend.md](backend.md) for which are approved |

For any other library, framework or SDK, fetch the documentation with Context7
rather than writing from memory. That rule is not native-specific, but native
code is where a wrong API signature costs a full rebuild to discover.

---

## 3. Formatting

**There is no native formatter in this repository.** No ktlint, no spotless, no
SwiftLint, no SwiftFormat, no `.editorconfig`.

- Prettier covers `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.yml` only
  (`scripts/format-changed.mjs`, the `SUPPORTED` pattern). It never reads a
  `.kt`, `.swift` or `.gradle` file.
- So the pre-push prettier gate cannot fail on native code, and passing it says
  nothing about native code.

Match the surrounding file by hand: its indentation, its brace placement, its
comment density, its naming. That is the whole standard. Do not introduce a
formatter without asking — adding one reformats every existing native file in
one commit and buries the real change.

The `modules/*/src/*.ts` contract files are ordinary TypeScript and **are**
formatted by prettier and typechecked by `tsc`. They are not linted: `npm run
lint` runs `expo lint src __tests__`, and `modules/` is in neither path.

---

## 4. Linting

There is none for native code. See section 3.

The closest thing to a lint is the compiler. Kotlin warnings and Swift warnings
appear in the Gradle and Xcode output and are worth reading, because nothing
else will surface them.

---

## 5. Testing

`npm test` runs Jest over JavaScript only. No instrumentation test or XCTest
target exists.

The camera module has JVM unit tests for its pure Kotlin
(`modules/native-identification-camera/android/src/test/`): `ViewZoomTest`,
`FieldCaptureConfigTest`, `RawJpegSettlementTest`. Run them with
`npm run test:android-unit` (prebuilds `android/` if missing, then Gradle
`:native-identification-camera:testDebugUnitTest`). CI does not run them. They
cannot reach the view or the module: anything touching CameraX, a `Context`
or Expo needs a device. To test new logic there, extract it into a pure class
first, as `ViewZoom` and `RawJpegSettlement` are.

So a native change is verified in exactly two ways, and you must say which one
you did:

1. **It compiled**, and its JVM tests pass where it has any. Necessary, never
   sufficient.
2. **It was driven on a device or emulator.** This is the real check.

Drive it with the `run` skill, and read on-device state with the tools in
[emulator_tools/](../../emulator_tools/) plus Metro's log — not screenshots.
Where a native view reports its own diagnostics, prefer those events over
inference: they are the only direct evidence of what the native layer did.

Report an uncompiled or undriven native change as **"needs test drive"**. Never
as fixed. A patch that was never run on hardware has not been verified, however
carefully it was read.

---

## 6. Building

See [builds.md](builds.md) for local commands, JDK and ABI selection, build
variables, Gradle troubleshooting, and the Android release workflow.

---

## 7. Before you commit

1. The change is in `modules/`, not in `android/` or `ios/`.
2. It compiled.
3. It was driven, or you said plainly that it was not.
4. Both platforms were considered. `modules/*/src/types.ts` is the shared
   contract: a prop added there is a promise both platforms are expected to
   keep. Expo silently ignores a prop a platform does not implement, so a
   half-implemented prop is inert rather than loud, and no check will catch it.
5. The implementation note is written — see [documentation.md](documentation.md).

---

## Related

- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) — the `modules/` layout and the
  one-way import rule
- [domain.md](domain.md) — camera seam vocabulary; use these terms
- [backend.md](backend.md) — which Firebase skills are approved
- [git.md](git.md) — the prettier gate
