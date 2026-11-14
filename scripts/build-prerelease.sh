#!/usr/bin/env bash
# Builds a standalone pre-release Android APK for sideloading.
#
# "Standalone" means a release variant: the JS is bundled into the APK, so it
# runs with no Metro and no dev client. The pre-release state comes from two
# build-time inputs:
#   - APP_VARIANT=prerelease   -> app.config.js sets extra.isPrerelease
#   - EXPO_PUBLIC_<FLAG>=true  -> inlined into the JS bundle at build time
# The applicationId is unchanged, so this installs over a release build.
#
# To add another test feature to the pre-release variant, add its
# EXPO_PUBLIC_* name to PRERELEASE_FLAGS below (and read it in
# src/shared/config/constants.ts).
#
# .env.android.local is layered on top of .env.local, as in run-android.sh:
# its keys are exported here, and Expo skips keys already in the environment.
# The pre-release keys below are exported last, so they always win.
#
# Prebuild runs with --clean, because the launcher label lives in generated
# native files. Run a plain prebuild before the next non-pre-release build.
# Needs no connected device: it assembles the APK and does not install it.
#
# Usage: bash scripts/build-prerelease.sh [extra gradlew args]
# Output: android/app/build/outputs/apk/release/app-release.apk
set -euo pipefail

cd "$(dirname "$0")/.."

PRERELEASE_FLAGS=(
  EXPO_PUBLIC_EXPERIMENTAL_CAMERA
)

if [ -f .env.android.local ]; then
  set -a
  . ./.env.android.local
  set +a
  echo "[build-prerelease] loaded .env.android.local"
fi

export APP_VARIANT=prerelease
echo "[build-prerelease] APP_VARIANT=$APP_VARIANT"
for flag in "${PRERELEASE_FLAGS[@]}"; do
  export "$flag=true"
  echo "[build-prerelease] $flag=true"
done

npx expo prebuild --platform android --clean

# assembleRelease bundles the JS into the APK itself; no Metro is involved.
cd android
exec ./gradlew assembleRelease "$@"
