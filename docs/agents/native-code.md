# Native code

Reference for Kotlin, Swift, Gradle and Xcode work in this repository. Read it
before you change any file under `modules/*/android/` or `modules/*/ios/`.

The one fact that governs everything else: **no JavaScript check in this repo
reads native code.** `npm run lint`, `npm test` and the prettier gate cannot
fail on a Kotlin or Swift mistake. A compile is the only check you have.

---

## 1. Where native code lives

| Path | Tracked | Edit it? |
| --- | --- | --- |
| `modules/native-identification-camera/android/src/main/java/…/*.kt` | yes | yes — this is the source |
| `modules/native-identification-camera/ios/*.swift` | yes | yes — this is the source |
| `modules/ios-camera-optimizer/ios/*.swift` | yes | yes — this is the source |
| `modules/*/android/build.gradle`, `modules/*/ios/*.podspec` | yes | yes, with care |
| `modules/*/src/*.ts` | yes | yes — the shared contract both platforms implement |
| `android/` | **no**, gitignored | **never** — `expo prebuild` regenerates it |
| `ios/` | **no**, gitignored | **never** — `expo prebuild` regenerates it |
| `modules/*/android/build/` | no | never — Gradle output |

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

| You are writing | Load |
| --- | --- |
| Any Expo module — a view, a prop, an event, a lifecycle hook | `expo-module` |
| CameraX — `ProcessCameraProvider`, `Preview`, `ImageCapture`, `SessionConfig` | `camerax` **and** `expo-module` |
| Xcode project settings, signing, schemes, build phases | `xcode-project-setup` |
| Dev-client behaviour, native debugging on device | `expo-dev-client` |
| Native UI on either platform | `expo-native-ui`, or `expo-ui` for SwiftUI/Compose |
| Firebase native SDK wiring | the matching `firebase-*` skill; see [backend.md](backend.md) for which are approved |

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

There is no native test suite, no instrumentation test, no XCTest target. `npm
test` runs Jest over JavaScript only.

So a native change is verified in exactly two ways, and you must say which one
you did:

1. **It compiled.** Necessary, never sufficient.
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

```bash
npm run preandroid   # restart adb, clear app storage — do this first
npm run android      # scripts/run-android.sh -> npx expo run:android
npm run ios          # Mac only
```

`scripts/run-android.sh` layers `.env.android.local` on top of `.env.local` and
echoes every key it defines, so a drive log records the settings the build
actually got. Only that script reads that file; it is inert for iOS, for `expo
start`, and for every other command.

When a Gradle build fails and you want the error rather than the whole log:

```bash
npm run clean-debug  # expo prebuild --clean, then gradlew assembleDebug, filtered
```

### The JDK, and why the build is pinned

Gradle builds this app on **JDK 17**, and that is correct, not a fallback. Expo
SDK 56 builds on 17, including on EAS. JDK 22 and later break the prefab/CMake
configure step: JEP 472 prints a restricted-method warning to stderr, and AGP
treats any stderr line from the prefab subprocess as fatal. Do not "upgrade" it.

Other tools on this machine need a newer JDK — `firebase-tools` refuses anything
below 21 — so the two requirements used to fight over `JAVA_HOME`.

They no longer do. Both settings live in `~/.gradle/gradle.properties`
(`GRADLE_USER_HOME`), which Gradle reads **before** the project's own file, and
where user-level keys win:

```properties
org.gradle.java.home=C:/Program Files/Java/jdk-17
org.gradle.workers.max=6
```

- `org.gradle.java.home` outranks the `JAVA_HOME` environment variable, so
  `PATH` and `JAVA_HOME` are free for a newer JDK and the build is unaffected.
  Confirm with `./gradlew --version`: it prints `Daemon JVM: … (from
  org.gradle.java.home)` while the launcher JVM may be anything.
- `org.gradle.workers.max` caps concurrency. The default is the logical core
  count. Several CMake configure tasks at once starved the machine, the OS
  killed the Kotlin daemon, and it surfaced as `DaemonCrashedException` and
  `SocketException: Connection reset`. If that symptom returns, check this value
  and the system load — not `JAVA_HOME`.

**Why not `android/gradle.properties`?** Because `expo prebuild --clean`
regenerates it and the fix disappears. That is how the worker cap was lost once
already. Both values describe this machine, not the project, so they belong in
the user-level file. A value that genuinely belongs to the project goes through a
`withGradleProperties` config plugin instead, which runs at prebuild and
therefore survives it.

A build is long. Run it in the background, redirect to a log file, and tail the
file. Do not pipe it through `tail` directly — the output buffers and you see
nothing until it ends.

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
- [git.md](git.md) — the prettier gate and the `docs/` submodule commit order
