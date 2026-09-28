#!/usr/bin/env bash
# Runs the Android build with .env.android.local layered on top of .env.local.
#
# Expo builds its env file list from NODE_ENV -- .env.[mode].local, .env.local,
# .env.[mode], .env -- and mode is development, production or test, never
# android. So .env.android.local is inert for iOS, for `expo start`, and for
# every other command; only this script reads it.
#
# Expo skips any variable that is already present in the environment
# (node_modules/@expo/env/build/index.js:402), so a key exported here wins over
# the same key in .env.local.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.android.local ]; then
  set -a
  . ./.env.android.local
  set +a
  echo "[run-android] loaded .env.android.local"
  # Echo whatever the file defines, so a drive log records the settings the
  # build actually got. The key names come from the file, so adding one needs
  # no change here.
  sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env.android.local |
    while read -r key; do
      echo "[run-android] $key=${!key:-unset}"
    done
else
  echo "[run-android] no .env.android.local; using .env.local only"
fi

exec npx expo run:android "$@"
