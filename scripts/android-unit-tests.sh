#!/usr/bin/env bash
# Runs the camera module's JVM unit tests (modules/native-identification-camera/
# android/src/test). They cover pure Kotlin only: no device, no emulator.
# Usage: npm run test:android-unit
set -euo pipefail

# android/ is generated; make it only when it is missing, so a run after a
# normal build reuses it.
if [ ! -d android ]; then
  npx expo prebuild --platform android
fi

cd android

# Expo autolinking names a local module's Gradle project after its folder.
exec ./gradlew :native-identification-camera:testDebugUnitTest "$@"
