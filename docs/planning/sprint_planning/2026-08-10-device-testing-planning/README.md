# Device-testing punch list (2026-08-10)

Every change below was implemented and unit/model/tsc/lint-verified in this
environment (no physical device or emulator available here — see
[test-driving.md](../../agents/test-driving.md)). None of it has run on a
real device yet. This is the checklist for whoever picks up the next
physical-device test drive. One section per PR/ticket; check off the
verification steps as they're confirmed.

Common setup: `bash scripts/device-monitor.sh` (or `npm run device-monitor`)
for native/system logcat, Metro's JSONL log (`.expo/dev/logs/start.log`) for
JS-side `console.*` output — see test-driving.md for why logcat alone won't
show `[analytics]`/`[location]`/`[nav]` tags on this project.

## Merged, needs first device pass

### #227 — Intro-flow T1 hardware back (closes #98)

- [ ] Launch fresh onto intro-flow T1. Press hardware back — confirm-exit
      Alert appears (Back/Exit).
- [ ] Back dismisses, stays on T1. Exit calls `BackHandler.exitApp()` and
      the app actually closes.
- [ ] Advance to T2+, press hardware back — default native pop still
      happens (no Alert), returns to the previous slide.

### #229 — Submission cache manual_time resync (closes #228)

- [ ] Library-pick a photo with no EXIF timestamp, fill in the manual
      date-time picker, submit.
- [ ] Inspect `submission_cache_<uuid>` (`databases/RKStorage`,
      `catalystLocalStorage`) — confirm `metadata.manual_time`/
      `metadata.time_method` reflect what was entered (previously stayed
      stale/undefined).

### #231 — Device-monitoring tooling (closes #201)

- [ ] Run `npm run device-monitor` while the app is running on a connected
      device — confirm it streams native/system logcat lines and survives
      an app restart (pid re-resolves automatically).
- [ ] Navigate between screens — confirm `[nav] <pathname>` appears in
      `.expo/dev/logs/start.log`.
- [ ] Unset `EXPO_PUBLIC_POSTHOG_KEY`, launch — confirm the
      `[analytics] disabled — EXPO_PUBLIC_POSTHOG_KEY not set` warning
      appears in Metro's log.
- [ ] Trigger `startLocationCapture()`'s exit points (deny consent, deny
      location permission, let it succeed) — confirm the new
      `[location]`-tagged lines actually appear in Metro's JSONL log (this
      was the whole point of the ticket — never confirmed live).

### #233 — Consent gates location UNAVAILABLE, FSM doc sync (closes #232)

- [ ] On a device/emulator where location reports `UNAVAILABLE` (or a
      build where the feature is genuinely absent), confirm the consent
      screen gates instead of proceeding to sign-in.

### #235 — Camera flash/flip cycle + permission/device gates

- [ ] Cycle flash via the flash icon — confirm it actually goes
      auto → on → off → auto on-device, not just in the mocked model.
- [ ] Flip camera — confirm front/back camera actually swaps.
- [ ] Deny camera permission — confirm "Camera Access Required" gate
      shows, Allow Camera / Open Settings both work.
- [ ] On a device/config with no camera device — confirm "No Camera
      Found" gate shows, Go Back works.

### #236 — Consent markAccepted() timing (relaunch bypass, reopened #66)

- [ ] Trigger a gated outcome (deny camera or location), force-quit the
      app, relaunch — confirm it lands back on the consent screen, not
      routed past it as already-consented.
- [ ] Grant access from Settings, background→foreground the app —
      confirm it proceeds to sign-in and consent is now recorded.

### #238 — Annotate carousel nav, remove-confirm, screen buttons

- [ ] Confirm a box on a non-last photo — carousel auto-advances to the
      next photo.
- [ ] Confirm a box on the last photo — no auto-advance.
- [ ] Previous button — steps back one photo, disabled/no-op on the first.
- [ ] Long-press the trash icon with `skip_photo_remove_confirm` off — see
      the 3-button Alert (Cancel / Remove don't ask again / Remove); with
      it on and no other-cat annotations, confirm it removes immediately
      with no Alert; with another cat's annotations present, confirm the
      warning copy and 2-button Alert appear regardless of the setting.
- [ ] Empty photo pool (all photos removed) — Go back button works.

### #239 — Consent gates camera DENIED, not just BLOCKED (closes #237)

- [ ] First-time full "Don't allow" on the camera permission prompt —
      confirm it gates (shows Permission Blocked), doesn't fall through as
      a full grant.

### #240 — Cat List actions + location-warning icon (open, not yet merged)

- [ ] Add a Cat from Submission Details — opens annotate.
- [ ] Tap a recorded cat's row — opens Cat Form pre-filled for that
      specific cat (test with 2+ cats recorded, confirm each row opens the
      right one).
- [ ] Finished! and Reset both work as expected.
- [ ] Location warning icon: tappable while no fix / low accuracy, opens
      the map picker; becomes disabled once a good fix is acquired.

## Not yet started — original cluster tickets

These need actual implementation/investigation work on-device, not just a
verification pass on something already built:

- **#157** — Home → Submission Details return path not discoverable.
- **#197** — Analytics events fire and drop silently right after accepting
  analytics consent. Still blocked on `EXPO_PUBLIC_POSTHOG_KEY` being unset
  in this checkout — `PostHogProvider` never mounts without it
  (`src/providers/AppProviders.tsx`), which voids this ticket's mandatory
  analytics check entirely until the key is set.
- **#76** — Beta release: verify photos have timestamps (parent ticket,
  partially verified for the Camera and EXIF-present Library-pick paths;
  the EXIF-less fallback is #224 below).

## Audited, not implemented — needs a device fixture specifically

### #224 — Library Pick Manual-time fallback

Code path traced and looks correct (`classifyLibraryPickTime`,
`CreateScreen`'s time-warning gate, `validation.ts`'s submit-block, and the
live-store-based API payload all check out) — but the actual claim ("EXIF-
less photo triggers Manual time on a real device") was never exercised
live. Needs a real EXIF-stripped fixture photo pushed to the device
(`exiftool -all= photo.jpg` before pushing, or PIL:
`Image.open(...).save(..., exif=b"")`) and a live pick-and-submit run —
confirm `time_type` flips to `'manual'`, the date-time-picker modal fires,
and the entered value lands in `submission.manual_time`.
