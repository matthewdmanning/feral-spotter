#!/bin/sh
# Capture a Hermes sampling profile of one cold start, plus the source map of
# the build that produced it.
#
#   sh hermes_startup_profile.sh [out-dir]
#
# Needs a release build made with plugins/withHermesStartupProfiler active:
#
#   HERMES_STARTUP_PROFILE=1 PROFILEABLE_BUILD=1 npx expo prebuild --platform android
#   (cd android && ./gradlew assembleRelease)
#   adb install -r android/app/build/outputs/apk/release/app-release.apk
#
# Do not use `npm run android`: its preandroid step runs `pm clear` and
# erases the login and permissions. `adb install -r` keeps app data.
#
# A plain prebuild keeps the profiler in MainActivity.kt. To remove it from the
# next build, run `npx expo prebuild --platform android --clean` without the
# variable.
#
# The profile is Hermes's JSON trace. Frames point into the bytecode bundle;
# the source map copied next to it maps them back to src/.
#
# MSYS_NO_PATHCONV=1 stops Git Bash rewriting the device paths.
PKG=com.mmanning.feralspotter
OUT=${1:-.}
REMOTE=/sdcard/Android/data/$PKG/files/hermes-startup.json
MAP=../android/app/build/generated/sourcemaps/react/release/index.android.bundle.map
STAMP=$(date +%Y-%m-%d_%H%M%S)

mkdir -p "$OUT"
MSYS_NO_PATHCONV=1 adb shell rm -f "$REMOTE"
MSYS_NO_PATHCONV=1 adb shell am force-stop $PKG
sleep 2
MSYS_NO_PATHCONV=1 adb shell am start -W -n $PKG/.MainActivity | grep TotalTime
# The plugin dumps the profile 6 s after MainActivity.onCreate.
sleep 9
MSYS_NO_PATHCONV=1 adb pull "$REMOTE" "$OUT/hermes-startup_$STAMP.json" || exit 1
cp "$(dirname "$0")/$MAP" "$OUT/hermes-startup_$STAMP.map" \
  || echo "source map not found at $MAP: symbolicate against the build's map"
