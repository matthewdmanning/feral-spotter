# Builds

For first-time setup, start with the [contributing guide](../../CONTRIBUTING.md).
For backend selection, see [backend.md](backend.md#test-drive-posture-emulator-by-default).
For device verification, use the [test-drive guide](test-driving.md).

## Local builds

| Build              | Command                                             | Metro |
| ------------------ | --------------------------------------------------- | ----- |
| Android debug      | `npm run android -- --device <serial>`              | Yes   |
| Android standalone | `npm run android -- --variant release --no-bundler` | No    |
| iOS debug (macOS)  | `npm run ios`                                       | Yes   |

Use Expo CLI for local builds. Run `npx expo prebuild --clean` when native
configuration or dependencies need to be regenerated. Keep persistent native
changes in the [native source or config plugins](native-code.md#1-where-native-code-lives).
See [device setup](test-driving.md#before-launching-the-app) for Metro access
over USB.

## Build settings and environment files

### Pull settings from GitHub

Install and authenticate the [GitHub CLI](https://cli.github.com/) and make sure
your account can list variables for the target environment in the repository.
From the repo root, after `npm ci`, run:

```bash
npm run env:pull -- development
npm run env:pull -- production
```

Pull only the mode you need. The optional second argument selects a GitHub
environment with a different name. The command replaces `.env.<mode>.local`
with the environment's variables. Rerun it after settings change. If Expo
cannot read a value verbatim, the command reports its name and preserves the
existing file.

If you cannot list environment variables, ask a maintainer for the settings
needed by your build and put them in `.env.local`. See
[backend.md](backend.md#test-drive-posture-emulator-by-default) for local emulator
settings. Live uploads need `EXPO_PUBLIC_UPLOAD_ADMISSION_URL`. Live Google
sign-in needs the native Firebase configuration and
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. PostHog client settings are optional for
builds that do not test analytics. Use `.env.example` for their names.

### Precedence and CI

- Expo uses exported shell values first, then `.env.<mode>.local`, `.env.local`,
  `.env.<mode>`, and `.env` in that order. Debug bundles use `development`
  and standalone release bundles use `production`.
- Keep shared non-secret settings in GitHub environment variables. Use
  `.env.local` for machine-local values and local copies of secrets. If you
  are migrating from `.env.android.local`, move machine-local values to
  `.env.local`, and pull shared variables from GitHub. The Android command no longer loads
  `.env.android.local`.
- The Android release job selects the GitHub `production` environment.
  Selection gives the workflow access to its variables and secrets. Only values
  explicitly referenced in the [workflow](../../.github/workflows/release.yml)
  reach the build. Map new build settings there when release needs them.
  `EXPO_PUBLIC_UPLOAD_ADMISSION_URL` is a GitHub variable.
- `EXPO_PUBLIC_*` values are embedded in the bundle. Restart Metro after changing
  them for a debug drive. Rebuild standalone artifacts to update their bundle.
  See [secrets.md](secrets.md) for what can ship in the app or be committed.
- App feature switches live in
  [`FEATURE_FLAGS`](../../src/shared/config/constants.ts). Some flags also
  read bundle-time environment values.

## Toolchain and troubleshooting

Use JDK 17 for Android Gradle, matching the release workflow. The Firebase
emulator launcher requires Java 21 or later. Set `RULES_TEST_JAVA_HOME` if
the launcher cannot find a suitable Java through `JAVA_HOME` or `PATH`.

The [Android config plugin](../../plugins/withPixel7Architecture.js) sets
`arm64-v8a` for direct Gradle builds. `expo run:android` can override that
default with the selected device's ABI, including `x86_64` for an emulator.
Keep the target connected while building. If installation fails with
`INSTALL_FAILED_NO_MATCHING_ABIS`, check `adb shell getprop ro.product.cpu.abi`
and rebuild for that target. The release workflow builds all four ABIs.

A full native build can need about 20 GB of free disk space. Check disk space
and system load if Kotlin daemons disappear or the system kills `clang`.
If VS Code imports the generated Android project and holds the Gradle cache,
set `java.import.gradle.enabled` to `false`.

Set the daemon JDK and optional worker cap in `~/.gradle/gradle.properties`
(or in `GRADLE_USER_HOME` if overridden). User-level keys take precedence over
project-level keys:

```properties
org.gradle.java.home=/path/to/jdk-17
org.gradle.workers.max=6
```

- `org.gradle.java.home` outranks the `JAVA_HOME` environment variable, so
  `PATH` and `JAVA_HOME` are free for a newer JDK and the build is unaffected.
  Confirm the daemon JDK with `./gradlew --version` from `android/`.
- `org.gradle.workers.max` caps concurrency. The default is the logical core
  count. Several CMake configure tasks at once starved the machine, the OS
  killed the Kotlin daemon, and it surfaced as `DaemonCrashedException` and
  `SocketException: Connection reset`. If that symptom returns, check this value
  and the system load — not `JAVA_HOME`.

`expo prebuild --clean` regenerates `android/gradle.properties`. Keep
machine-specific settings in the user-level file. For a project-wide setting,
use a `withGradleProperties` config plugin.

For a long build, redirect output to a log file and follow it from a second
terminal. Use `npm run clean-debug` to regenerate the Android project and see
filtered Gradle output from `assembleDebug`.

## Release candidate and stable builds

The [release workflow](../../.github/workflows/release.yml) builds and publishes
Android artifacts when a GitHub Release is published with a SemVer tag.

```bash
gh release create v0.2.1-rc.1 --prerelease --generate-notes
gh release create v0.2.1 --generate-notes
```

The workflow and [Expo app config](../../app.config.js) derive release metadata from the tag and workflow run.

| Value            | Source                              | Example (`v0.2.1-rc.1`) |
| ---------------- | ----------------------------------- | ----------------------- |
| `versionName`    | Tag without `v` (`android.version`) | `0.2.1-rc.1`            |
| `versionCode`    | `github.run_number`                 | `41`                    |
| Expo `version`   | Tag without pre-release part        | `0.2.1`                 |
| `APP_VARIANT`    | `rc` when "pre-release" is set      | `rc`                    |
| RC test features | `EXPO_PUBLIC_EXPERIMENTAL_CAMERA`   | `true`                  |
| Launcher label   | `… (rc)` for a pre-release          | `feral-spotter (rc)`    |

The workflow stops when the tag and the "pre-release" setting disagree. It
builds a universal APK and an AAB for all four ABIs, prints the APK metadata
(`aapt dump badging`) in the job log, and attaches
`feral-spotter-<tag>.apk` and `feral-spotter-<tag>.aab` to the release.

Release candidates and stable builds share the application ID in
`google-services.json` and install over one another.

By default, a local build uses the latest reachable `v*` tag, or `0.0.0` if
there is none, and `versionCode` 1.

The build job has read-only repository access and follows the GitHub
environment's approval rules. A separate `publish` job attaches the artifacts
to the release.

To add a release candidate test feature, add its `EXPO_PUBLIC_*` name to the
workflow `env` with `${{ github.event.release.prerelease }}`, and read it in
`src/shared/config/constants.ts`. Artifacts are signed with the template debug
key until issue #330 adds a release keystore.

Sources: [GitHub deployments and environments](https://docs.github.com/actions/reference/workflows-and-actions/deployments-and-environments),
[gh variable](https://cli.github.com/manual/gh_variable_get),
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/),
[Expo without EAS](https://docs.expo.dev/eas/environment-variables/without-eas/),
[Firebase security checklist](https://firebase.google.com/support/guides/security-checklist).
