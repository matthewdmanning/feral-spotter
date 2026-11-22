# Builds

How to build the app, and where each build setting comes from. For driving a
build on a device, see [test-driving.md](test-driving.md). For backend modes
(mock / emulator / live), see [backend.md](backend.md).

## Build kinds

| Kind              | Command                                             | Metro |
| ----------------- | --------------------------------------------------- | ----- |
| Debug, local      | `CI=1 npm run android -- --device <serial>`         | Yes   |
| Standalone, local | `npm run android -- --variant release --no-bundler` | No    |
| Release           | the release workflow in `.github/workflows/`        | No    |

- Use Expo CLI local builds. Do not use paid EAS builds.
- Before a local build, run `npm run env:pull -- <mode>` (see below).
- A debug build opens the dev client at the machine's LAN address, which a
  USB phone cannot reach. Run `adb reverse tcp:8081 tcp:8081`, then open
  the dev client at `http://localhost:8081`.

## Where settings come from

| Setting                   | Local build                                                                         | CI                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Non-secret build settings | GitHub environment variables, pulled into `.env.<mode>.local` by `npm run env:pull` | The same variables, through the workflow's `environment:` |
| Secrets                   | `.env.local` (gitignored)                                                           | GitHub environment secrets                                |
| Feature flags             | `FEATURE_FLAGS` in `src/shared/config/constants.ts`                                 | Same                                                      |

- GitHub gives environment variables only to workflow jobs that reference the
  environment. A local build gets them only by fetching them.
- `npm run env:pull -- <mode> [github-environment]` writes the environment's
  variables to `.env.<mode>.local`. Expo loads that file first for the
  build's mode: debug is `development`, release is `production`. The GitHub
  environment defaults to the mode's name. Rerun it after a variable
  changes. If a value cannot be represented in Expo's env format, the
  command reports the variable name and preserves the current file.
- GitHub secrets cannot be read back, so local builds keep secrets in
  `.env.local`.
- Keep each value in one source. Do not copy a GitHub variable into a
  committed file or into `.env.local`.
- `EXPO_PUBLIC_*` values ship inside the app in plain text. Never put a
  secret in one. Firebase ids (project id, bucket, API key) are identifiers,
  not secrets: Security Rules, Auth and App Check protect the data.
- Expo reads only `.env`, `.env.local` and the `.env.<mode>*` files. A
  file with any other name is ignored.
- `EXPO_PUBLIC_*` values are set at bundle time. A debug build needs a Metro
  restart to see a change. A standalone build embeds the bundle and needs a
  rebuild.

## Toolchain

- Gradle runs on JDK 17, pinned by `org.gradle.java.home` in
  `~/.gradle/gradle.properties`. `JAVA_HOME` stays free for newer JDKs.
- The Firebase CLI and emulators need JDK 21+.
- Local builds target `arm64-v8a` only (Pixel 7). `expo run:android` builds
  the ABI of the device connected when the build starts.
- A full native build needs about 20 GB free on the system drive. A full
  disk fails as a lost Kotlin daemon or a killed `clang`, not as a disk
  error.
- VS Code must not import `android/` as a Gradle project
  (`java.import.gradle.enabled: false`). A second Gradle locks
  `~/.gradle/caches`.
- `android/` and `ios/` are generated. Never edit them; see
  [native-code.md](native-code.md).

Sources: [GitHub deployments and environments](https://docs.github.com/actions/reference/workflows-and-actions/deployments-and-environments),
[gh variable](https://cli.github.com/manual/gh_variable_get),
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/),
[Expo without EAS](https://docs.expo.dev/eas/environment-variables/without-eas/),
[Firebase security checklist](https://firebase.google.com/support/guides/security-checklist).
