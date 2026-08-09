#!/usr/bin/env bash
# scripts/device-monitor.sh
# Streams pid-scoped ReactNativeJS/AndroidRuntime/System.err logcat lines
# plus package-scoped ActivityManager lines for a physical-device test
# drive (#201). Re-resolves the app's pid automatically after every
# relaunch, so a restart mid-session doesn't silently start filtering on
# a stale/dead pid.
#
# Caveat (found 2026-08-09, #201): on this project's architecture, JS
# console.log/warn output (our [analytics]/[location]/[nav] tags) does
# NOT reliably reach logcat's ReactNativeJS tag — check Metro's JSONL log
# (.expo/dev/logs/start.log) for those instead. This script is reliable
# for native crashes (AndroidRuntime), stderr (System.err), and
# system-level app-lifecycle events (ActivityManager).
set -euo pipefail

PACKAGE="com.mmanning.feralspotter"

get_pid() {
  adb shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r\n '
}

echo "[device-monitor] waiting for $PACKAGE to start..."
while [ -z "$(get_pid)" ]; do
  sleep 1
done

cleanup() {
  [ -n "${logcat_pid:-}" ] && kill "$logcat_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

logcat_pid=""

while true; do
  pid="$(get_pid)"
  while [ -z "$pid" ]; do
    echo "[device-monitor] $PACKAGE not running — waiting for (re)start..."
    sleep 1
    pid="$(get_pid)"
  done

  echo "[device-monitor] watching pid=$pid"
  adb logcat -c

  pattern="^[IWEVD]/(ReactNativeJS|AndroidRuntime|System\.err)\( *${pid}\)|^[IWEVD]/ActivityManager\(.*\): .*${PACKAGE}"
  adb logcat -v brief | grep --line-buffered -E "$pattern" &
  logcat_pid=$!

  # Poll until the app's pid changes (relaunch) or disappears (exit) —
  # `adb logcat --pid` isn't used directly because ActivityManager lines
  # come from system_server, not the app process, so a single native
  # `--pid` filter can't capture both.
  while kill -0 "$logcat_pid" 2>/dev/null; do
    current="$(get_pid)"
    if [ "$current" != "$pid" ]; then
      echo "[device-monitor] pid changed ($pid -> ${current:-none}) — restarting logcat"
      kill "$logcat_pid" 2>/dev/null || true
      wait "$logcat_pid" 2>/dev/null || true
      break
    fi
    sleep 1
  done
done
