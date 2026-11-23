# Contributing to FeralSpotter

## Develop locally

The app uses Expo SDK 58, React Native 0.88, TypeScript 6, Expo Router, Zustand, Unistyles, and Firebase Auth/Storage. Native camera and other modules require a development build; Expo Go is insufficient.

Prerequisites:

- Node.js **24.x** and npm.
- Android SDK/build tools and a connected device or emulator for Android; macOS and Xcode for iOS.
- Java for Android builds and Firebase emulators. Follow the [toolchain setup](docs/agents/builds.md#toolchain-and-troubleshooting).
- Project-specific Firebase native configuration (`google-services.json` / `GoogleService-Info.plist`) and provider setup for real sign-in. Obtain these from the maintainer; do not commit private credentials.

```bash
npm ci
```

1. [Configure development build settings](docs/agents/builds.md#pull-settings-from-github), including GitHub CLI access or manual setup.
2. [Choose a backend mode](docs/agents/backend.md#test-drive-posture-emulator-by-default). For testing Auth and photo uploads without production data, set up the Firebase emulators before launching the app.
3. [Build and launch the app](docs/agents/builds.md#local-builds).

## Check changes

```bash
npm run typecheck
npx expo lint
npm test -- --runInBand
npm run test:rules
npm ci --prefix functions
npm run test:functions -- --runInBand
```

The rules command starts local Auth/Storage emulators and tests the repository's rules. Native camera, permission, layout, and sign-in behavior still need device testing; passing Jest does not verify those seams.

See [project structure](docs/PROJECT_STRUCTURE.md), the [manual QA checklist](docs/qa_checklist.md), and [open issues](https://github.com/matthewdmanning/feral-spotter/issues) for architecture, validation, and remaining work. Report a bug with the build/commit, device, reproduction steps, and expected versus observed behavior.
