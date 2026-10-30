#!/usr/bin/env bash
set -euo pipefail

npx expo prebuild --clean

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

cd android

# No --continue: Gradle stops at the first failed task, so a breaking error
# ends the build at once.
if ./gradlew assembleDebug --stacktrace > "$LOG" 2>&1; then
  echo "Build succeeded."
else
  echo ""
  echo "=== BUILD FAILED ==="
  grep -E "^(e:|error:|FAILURE:|FAILED|> Task|Caused by:|Exception in)" "$LOG" \
    || grep -E "(error|FAILED|Exception)" "$LOG" | head -40
  exit 1
fi
