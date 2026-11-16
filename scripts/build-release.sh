#!/usr/bin/env bash
# Builds a standalone release candidate (rc) or stable Android APK for
# sideloading.
#
# "Standalone" means a release variant: the JS is bundled into the APK, so it
# runs with no Metro and no dev client. Neither type is a debug build.
#
# rc gets its state from two build-time inputs:
#   - APP_VARIANT=rc           -> app.config.js sets extra.isReleaseCandidate
#   - EXPO_PUBLIC_<FLAG>=true  -> inlined into the JS bundle at build time
# stable unsets APP_VARIANT and every RC flag, so test features stay off.
# The applicationId is unchanged, so either APK installs over the other.
#
# To add another test feature to the rc type, add its EXPO_PUBLIC_* name to
# RELEASE_CANDIDATE_FLAGS below (and read it in src/shared/config/constants.ts).
#
# .env.android.local is layered on top of .env.local, as in run-android.sh:
# its keys are exported here, and Expo skips keys already in the environment.
# The keys below are set last, so they always win.
#
# Prebuild runs with --clean, because the launcher label lives in generated
# native files. Needs no connected device: it assembles the APK and does not
# install it.
#
# Usage: bash scripts/build-release.sh rc|stable [extra gradlew args]
# Output: android/app/build/outputs/apk/release/app-release.apk
set -euo pipefail

cd "$(dirname "$0")/.."

RELEASE_TYPE="${1:-}"
case "$RELEASE_TYPE" in
  rc | stable) shift ;;
  *)
    echo "Usage: bash scripts/build-release.sh rc|stable [extra gradlew args]" >&2
    exit 1
    ;;
esac

RELEASE_CANDIDATE_FLAGS=(
  EXPO_PUBLIC_EXPERIMENTAL_CAMERA
)

if [ -f .env.android.local ]; then
  set -a
  # Strip CRs: a Windows-saved file otherwise fails under set -e.
  . <(tr -d '\r' < .env.android.local)
  set +a
  echo "[build-release] loaded .env.android.local"
fi

if [ "$RELEASE_TYPE" = rc ]; then
  export APP_VARIANT=rc
  for flag in "${RELEASE_CANDIDATE_FLAGS[@]}"; do
    export "$flag=true"
    echo "[build-release] $flag=true"
  done
else
  unset APP_VARIANT "${RELEASE_CANDIDATE_FLAGS[@]}"
fi
echo "[build-release] type=$RELEASE_TYPE APP_VARIANT=${APP_VARIANT:-}"

npx expo prebuild --platform android --clean

# assembleRelease bundles the JS into the APK itself; no Metro is involved.
cd android
exec ./gradlew assembleRelease "$@"
