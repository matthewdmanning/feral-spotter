# #197 — Analytics capture-drop / double-fire race

[GitHub issue #197](https://github.com/matthewdmanning/feral-spotter/issues/197) · label `needs-info` (was `needs-physical-device`) · common context: [README](../README.md)

## Status: blocked on environment config, not device access

Relabeled 2026-08-09 — this cannot be tested on any physical device right
now, in this checkout, because `EXPO_PUBLIC_POSTHOG_KEY` is unset anywhere
(empty `.env`, no entry in `.env.local`, no `.env.example`).
`PostHogProvider` never mounts without it (`src/providers/AppProviders.tsx:72-86`),
so every `captureEvent` call warns `capturer not registered` regardless of
whether the race exists. Confirmed by timing: a warning fired
several seconds and 4 screen transitions after the consent-accept tap —
too late to be a millisecond registration race, consistent with "never
registers at all."

**This likely also explains the original 2026-08-07 filing** — same
machine, probably same missing key, so those 4 warnings may not have been
evidence of the race either.

## What's still real (code-level, not device-proven)

The ordering bug in `src/screens/analytics-consent/index.tsx`'s
`handleContinue` is visible by source inspection: it flips the consent
store synchronously, then immediately calls `router.replace` in the same
callback — no wait for the provider-tree remount + `AnalyticsBridge`'s
`useEffect` (`src/providers/AppProviders.tsx:53-61`) to actually register
the capturer. This is a real ordering gap regardless of device proof.

## To actually resolve this

Either:

1. Get a real `EXPO_PUBLIC_POSTHOG_KEY` into `.env.local`, then retest on
   device: clean install, 0 cached submissions (rules out
   `src/hooks/useFeralReports.ts`'s per-cache mount-effect as an alternate
   warning source), accept consent, and check whether an event fires inside
   the remount window. Or:
2. Skip device proof and fix `handleContinue` directly — await the
   provider remount / `registerCapture()` before navigating, or queue/replay
   calls made while unregistered instead of dropping them (both suggested
   in the original issue body).

## Suggested skills

- If fixing without device proof: `tdd` — this is provider-mount-order
  logic, model the sequence per [testing.md](../../../agents/testing.md)
  rather than adding an isolated regression test only.
