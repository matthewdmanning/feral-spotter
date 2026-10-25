# Plan: Macrobenchmark for camera startup and capture

Last updated: 2026-10-23. Branch: `perf-build-profile`. Status: plan, not started.

## Goal

Replace the hand-driven Perfetto runs with a repeatable Jetpack Macrobenchmark
test. One command runs N iterations on the Pixel 7 and reports min, median and
max for app startup, camera first frame, capture and frame timing.

## Why the hand-driven runs are not enough

Two manual runs on 2026-10-23 gave these problems:

| Problem                                                                       | Effect                                         |
| ----------------------------------------------------------------------------- | ---------------------------------------------- |
| `emulator_tools/tapd.sh` runs a `uiautomator` dump before each tap            | CPU load during the measurement; slow taps     |
| One run per condition                                                         | No way to separate the signal from the noise   |
| Reboot was the only way to clear the page cache                               | Slow, and post-boot work loads the CPU         |
| Compile state, shader cache, CPU clocks and thermal state were not controlled | Unknown variation between runs                 |
| Flash on `auto`, scene and light not fixed                                    | Exposure changes frame timing and capture time |
| The fixed 30 s trace cut off captures 3 and 4                                 | Lost data                                      |

Baseline numbers from those runs (cold, after reboot, 1 run): startup 1074 ms,
`bindToFirstFrame` 827 ms, first `capture` 660 ms, second `capture` 284 ms.

## What Macrobenchmark controls (from the docs)

| Control                                                          | Source                                           |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| Page cache drop without root on API 31+ (Pixel 7 is API 34)      | benchmark release notes, 1.1.0-alpha09           |
| `CompilationMode` per run                                        | Macrobenchmark docs                              |
| Shader cache drop (needs `profileinstaller` 1.3.0+ in the app)   | benchmark release notes, 1.2.0-alpha07           |
| Clock lock without root ("fixed performance mode")               | benchmark release notes, 1.6.0-alpha01           |
| Thermal throttle detection and cooldown                          | benchmark release notes, 1.1.0-beta04            |
| `TraceSectionMetric`, `FrameTimingMetric`, `StartupTimingMetric` | benchmark release notes, 1.2.0 and 1.3.0-alpha01 |

## Design

### Files

| File                                      | Tracked | Purpose                                                                     |
| ----------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `benchmark/macrobenchmark/build.gradle`   | yes     | `com.android.test` module, `targetProjectPath = ":app"`, self-instrumenting |
| `benchmark/macrobenchmark/src/main/...Kt` | yes     | `CameraStartupBenchmark` test class                                         |
| `plugins/withMacrobenchmark.js`           | yes     | Config plugin: wires the module into the generated `android/`               |
| `app.json`                                | yes     | Register the plugin                                                         |

The module source lives outside `android/`, because `android/` is generated
and gitignored (see `docs/agents/native-code.md`). The config plugin adds:

1. `withSettingsGradle`: `include ':macrobenchmark'` and
   `project(':macrobenchmark').projectDir = new File(rootDir, '../benchmark/macrobenchmark')`.
2. `withAppBuildGradle`: a `benchmark` build type (`initWith release`,
   debug signing, `matchingFallbacks = ['release']`), and the
   `androidx.profileinstaller` dependency if autolinking does not bring it in.

Confirm the exact module `build.gradle` against the Macrobenchmark setup page
before writing it. The Context7 results did not include the full setup block.

### Test class

One test class, `CameraStartupBenchmark`, with two tests:

| Test                      | Startup mode | Metrics                                                                                        |
| ------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `coldStartToFirstCapture` | `COLD`       | `StartupTimingMetric`, `TraceSectionMetric` for each `FeralCam:*` section, `FrameTimingMetric` |
| `repeatedCaptures`        | `WARM`       | `TraceSectionMetric("FeralCam:capture", Mode.Sum/Min/Max)`, `FrameTimingMetric`                |

Per iteration: launch, tap Take Photos, wait for `Capture photo`, set flash to
off, take N captures, wait for `Done (N)`. Use the UiAutomator 2.4 API that
Macrobenchmark 1.5 exposes (`onElement { ... }.click()`). Find elements by
content-desc; the app already sets them.

Compilation is set outside Macrobenchmark (see decision 1). Set it with a
shell command before each test run:

| State                          | Command                                                               |
| ------------------------------ | --------------------------------------------------------------------- |
| Worst case, like a new install | `adb shell cmd package compile --reset com.mmanning.feralspotter`     |
| Stable, low noise              | `adb shell cmd package compile -f -m speed com.mmanning.feralspotter` |

Start with 10 iterations, then check the spread.

### Device setup per session

- Pixel 7 on a stand, pointed at one fixed scene, constant light.
- Plugged in, screen on, screen timeout long.
- Run `./gradlew lockClocks` if the 1.6.0-alpha01 plugin is used.

## Decisions

1. **Keep the app data** (decided 2026-10-23). By default, Macrobenchmark
   reinstalls the app for each test method to reset compilation, and that
   reinstall clears the login and the permissions (release notes,
   1.1.0-rc02). Turn off its compilation step with the instrumentation
   argument `androidx.benchmark.compilation.enabled=false` in the module
   `defaultConfig`. Set compilation from the shell instead (see Test class).
   Never run `npm run preandroid` or `pm clear` in this workflow.

## Risks and open questions

1. **Reinstall with compilation off.** Confirm on the device that 1.5.x does
   not reinstall or clear data when compilation is off. Check that the login
   is still there after the first run. Unverified.
2. **Async trace sections.** The camera code uses `Trace.beginAsyncSection`.
   It is not confirmed that `TraceSectionMetric` reads async slices. Fallback:
   `TraceMetric` with our own Perfetto SQL (the queries in the scratchpad
   `analyze_trace.py` already work).
3. **Draft photos build up.** The submission draft keeps photos between
   iterations. The setup block must discard the draft through the UI.
4. **AGP and Kotlin versions.** The module must match the AGP and Kotlin
   versions that Expo SDK 56 pins. Read them from the generated `android/`
   at implementation time.
5. **Release signing.** The `release` build type uses debug signing today, so
   the `benchmark` build type can too.

## Steps

1. Set compilation with `cmd package compile` (see Test class).
2. Write `plugins/withMacrobenchmark.js` and register it in `app.json`.
3. Write the module `build.gradle` and `CameraStartupBenchmark`.
4. Run `PROFILEABLE_BUILD=1 npx expo prebuild --clean` (without it the
   `FeralCam:*` trace sections stay off), then
   `./gradlew :macrobenchmark:connectedBenchmarkAndroidTest`.
5. Read the JSON results; compare with the baseline numbers above.
6. Write the implementation note (`docs/agents/documentation.md`).

## Sources

- https://developer.android.com/topic/performance/baselineprofiles/measure-baselineprofile
- https://developer.android.com/codelabs/android-macrobenchmark-inspect
- https://developer.android.com/jetpack/androidx/releases/benchmark
- https://developer.android.google.cn/topic/performance/benchmarking/microbenchmark-overview
