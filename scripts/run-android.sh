#!/usr/bin/env bash
# Runs the Android build with .env.android.local layered on top of .env.local.
#
# Expo builds its env file list from NODE_ENV -- .env.[mode].local, .env.local,
# .env.[mode], .env -- and mode is development, production or test, never
# android. So .env.android.local is inert for iOS, for `expo start`, and for
# every other command; only this script reads it.
#
# Expo skips any variable that is already present in the environment
# (node_modules/@expo/env/build/index.js:402). So EXPO_PUBLIC_USE_FIREBASE_EMULATOR
# exported here wins over EXPO_PUBLIC_USE_FIREBASE_EMULATOR in .env.local, and
# the same holds for any other key this file overrides.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.android.local ]; then
  set -a
  . ./.env.android.local
  set +a
  echo "[run-android] loaded .env.android.local"
  echo "[run-android] EXPO_PUBLIC_USE_FIREBASE_EMULATOR=${EXPO_PUBLIC_USE_FIREBASE_EMULATOR:-unset}"
else
  echo "[run-android] no .env.android.local; using .env.local only"
fi

exec npx expo run:android "$@"
