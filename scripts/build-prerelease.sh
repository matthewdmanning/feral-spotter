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
# .env.android.local is layered on top of .env.local, as in run-android.sh.
# Variables already in the environment win over both files, except the
# pre-release ones below, which this script forces.
#
# Usage: bash scripts/build-prerelease.sh [extra `expo run:android` args]
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

# --no-bundler: a release build bundles JS itself and must not start Metro.
exec npx expo run:android --variant release --no-bundler "$@"
