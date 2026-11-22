# Contributing to FeralSpotter

## Develop locally

The app uses Expo SDK 58, React Native 0.88, TypeScript 6, Expo Router, Zustand, Unistyles, and Firebase Auth/Storage. Native camera and other modules require a development build; Expo Go is insufficient.

Prerequisites:

- Node.js **24.x** and npm.
- Android SDK/build tools and a connected device or emulator for Android; macOS and Xcode for iOS.
- A JDK compatible with the native build toolchain. The Firebase emulator rules lane uses JDK 21.
- Project-specific Firebase native configuration (`google-services.json` / `GoogleService-Info.plist`) and provider setup for real sign-in. Obtain these from the maintainer; do not commit private credentials.

```bash
npm ci
npm run env:pull -- development
```

See the [build guide](docs/agents/builds.md) for GitHub environment variables and local settings. Configure the environment for the intended backend mode. Use the [local Firebase emulator instructions](docs/agents/backend.md#test-drive-posture-emulator-by-default) for Auth/Storage testing without production data. Fully offline development stubs are also available with `EXPO_PUBLIC_AUTH_MOCK=true` and `EXPO_PUBLIC_UPLOADS_MOCK=true`; those do not validate Firebase behavior.

```bash
npx expo prebuild --clean
npm run android
# macOS, after completing iOS native configuration:
npm run ios
```

`prebuild --clean` regenerates the native projects; put persistent native changes in config plugins or local modules. See [native development guidance](docs/agents/native-code.md).

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
