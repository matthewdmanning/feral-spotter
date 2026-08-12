---
title: Photo library access — explicit consent gate
aliases:
  - Feature implementation note
tags:
  - implementation
---

# Photo library access: require explicit yes, not absence of no

**Scope:** fix
**Issues/spec:** #249
**Date:** 2026-08-11
**Branch/PR:** issue-249-photo-library-consent-gate

## Scope

**In scope:**

- [x] Explicit permission check before `launchImageLibraryAsync()`
- [x] Denial shows a Settings-recovery message, picker never opens
- [x] `limited` (iOS "Select Photos") counts as a valid yes
- [x] Check-only short-circuit on repeat taps (no re-request once granted)

**Out of scope / not addressed:**

- Camera's separate write-only gallery-save permission (`useCameraCapture.tsx`) — no user-visible bug there, untouched.
- The unreproduced "app exits on Don't allow" report from #64's punchlist — current architecture can't hard-exit on this path; no repro, not investigated.
- `consentDisclosure.json`'s upfront `ConsentScreen` copy — this is a point-of-use permission, deliberately deferred there per #91.
- React Native/Expo not surfacing the coarse/fine location-accuracy distinction — a separate, unrelated location-permission display concern raised alongside #249's spec.

## Intent

**Purpose:** `pickFromLibrary()` called `ImagePicker.launchImageLibraryAsync()` directly — the OS permission prompt fired invisibly inside that call, so a decline and "backed out of the picker without choosing anything" both resolved as `{ canceled: true }`, indistinguishable. The app never confirmed consent as its own yes/no. This extends the "explicit yes, never absence of no" principle already enforced for camera (#237) and location (#66/#243) to photo-library read access.

## Design decisions and reasoning

### Where the gate lives

- **Decision:** Check-then-request-then-gate lives inline at the top of `pickFromLibrary()`, not as a separate hook/screen.
- **Reason:** Mirrors the existing check-only short-circuit pattern for the camera's write-only gallery-save permission (`useCameraCapture.tsx`, #145/#146) — `getMediaLibraryPermissionsAsync()` first; only call `requestMediaLibraryPermissionsAsync()` if not already usable.
- **Affected journey/state:** `useLibraryPhotoPicker.pickFromLibrary` — idle → opened (granted/limited) or blocked (denied).

### Denial UX: Alert, not a full-screen gate

- **Decision:** A denial shows a one-shot `Alert.alert` with Cancel / Open Settings, then returns — no `ConsentScreen`-style full-screen "Permission Blocked" replace, no `AppState` foreground-recheck listener.
- **Reason:** This isn't a screen-level gate the user is stuck behind — a denial just stops the current pick attempt. The next tap re-invokes `pickFromLibrary()` and re-checks fresh, so there's nothing for a recheck listener to unstick.
- **Affected journey/state:** `blocked` state — terminal for that tap, not a trap.

## What shipped

- `src/hooks/useLibraryPhotoPicker.ts`: added `isLibraryPermissionUsable()` (granted or `limited` accessPrivileges) and the check → request → gate block before `launchImageLibraryAsync()`. Denial message: "Photo library access needed" / "Choose from Library needs access to your photos. Enable it in Settings, then try again." with a Cancel/Open Settings (`Linking.openSettings()`) action sheet.
- No other files changed — `src/screens/home/index.tsx` and `src/screens/submission/create/index.tsx` both just call `pickFromLibrary()` with no args; the hook's public signature is unchanged.

## Tests

**Model or flow covered:** `useLibraryPhotoPicker`'s permission-check branching (not a screen-level flow — the hook's own gate).

| Test file                                                                | What it verifies                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/__tests__/useLibraryPhotoPicker.permissionGate.model.test.ts` | already-granted → picker opens, no request call; undetermined → request → granted → opens; undetermined → request → denied → Alert fires, picker never opens; short-circuit (no re-request once granted); denial Alert's Open Settings button calls `Linking.openSettings()` |

**Not tested:**

- `limited` as a separate journey — it hits the identical `isLibraryPermissionUsable` branch as `granted` (same assertions, no new coverage); the implementation's check itself covers it.
- Downstream pick-processing (photo-store writes, EXIF time classification, navigation) — unchanged by #249, already exercised by the hook's existing behavior prior to this change, out of scope for this gate-only model.

## Verification status

**Run and passing:**

- [x] Type checking: `npx tsc --noEmit`
- [x] Unit/model tests: `npx jest` (full suite — 50 suites, 209 tests, all passing)
- [x] Lint: `npx eslint src/hooks/useLibraryPhotoPicker.ts src/hooks/__tests__/useLibraryPhotoPicker.permissionGate.model.test.ts`
- [x] Formatting: `npx prettier --write` on both changed files

**Unverified:**

- No real-device/emulator tap-through of the actual OS permission dialog (first-time deny → Settings grant → re-tap). Pure logic + mocked native module only.

## Follow-ups and known limitations

- A real-device test-drive pass (first-time deny, then Settings-grant, then re-tap) is worth a run-note given this touches a live permission dialog — not done as part of this change.
