# Test drive: Reports history map and Profile Pic

- **Git state:** `main` @ `0d8ac26` (PR #429 merge)
- **Device:** Pixel 7 (physical, arm64-v8a), debug build, Metro with `CI=1`
- **Backend:** live Firebase (`[firebase] mode: live`). The user chose no emulators.
- **Env:** `.env.android.local` loaded into Metro (native camera capture on)
- **Logs:** `docs/test-drives/logs/2026-11-01-reports-history-map-metro.log`

## Results

| Feature                                             | Result                                                                                    | Evidence                                                                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Reports empty state                                 | Pass. "0 total", no map.                                                                  | dump                                                                                                         |
| Profile Pic picker in Cat Form                      | Pass. Photo 1 checked by default. Tap moves the check to photo 2. Star badge not clipped. | dump `checked=`; `screen-captures/2026-11-01_reports-history-map/2026-11-01_profile-pic-picker-selected.png` |
| Submit writes history row                           | Pass. "1 total", Submitted card, 2 photos, 1 cat.                                         | dump                                                                                                         |
| Map renders with cat-head pin                       | Pass. One pin, no badge (1 cat).                                                          | `screen-captures/2026-11-01_reports-history-map/2026-11-01_reports-map-pin-and-card.png`                     |
| Pin press opens Sighting view                       | Pass. `/sighting/a9d17767-…`                                                              | Metro `[nav]`                                                                                                |
| Sent card press opens Sighting view                 | Pass. Same route.                                                                         | Metro `[nav]`                                                                                                |
| Sighting view content                               | Pass with one finding (below). Location, GPS accuracy, counts, 8 cat attributes.          | `screen-captures/2026-11-01_reports-history-map/2026-11-01_sighting-view-profile-pic.png`                    |
| In Progress card is pressable and resumes the draft | Pass. Opens `/submission/create`.                                                         | dump `clickable="true"`; Metro `[nav]`                                                                       |
| Profile Pic shows the chosen photo                  | Not verified. Both photos are dark, so the crop does not show which photo it came from.   | screenshot                                                                                                   |
| Map touch pauses Reports scroll                     | Not tested. The list is too short to scroll.                                              | —                                                                                                            |
| Spot grouping, count badge, 9+ cap                  | Not tested. Only 1 sent Sighting.                                                         | —                                                                                                            |
| Abandoned draft card is not pressable               | Not tested.                                                                               | —                                                                                                            |

## Findings

1. **Sighting view time label is wrong.** "Time from" shows "Time of submission" for `time_method: 'device'` (`src/lib/sightings/history.ts`, `TIME_SOURCE`). The time shown is `created_at`, the draft start (1:32 PM). The submit happened at about 1:34 PM.
2. **Report card cuts off the time.** The Submitted card shows "1:…" in place of "1:32 PM".
3. **In Progress card shows "None" for cats.** The draft has 1 cat. The cache row gets `cats` only on Submit.
4. **Map tiles are dark.** The implementation note says the tiles are light in both themes.
5. **Cat Form crop preview covers the Clear button.** Only the "r" of "Clear" shows.
6. **`PRELOAD` errors at startup.** Metro logs `The action 'PRELOAD' with payload {"name":"feral-reports"} was not handled by any navigator`, and the same for `settings`.

## Every-run checks

- **PostHog consent:** the analytics checkbox is on by default (`defaultChecked`). The drive left it on, so PostHog events were allowed. The drive did not test the unchecked case.
- **GPS:** the location fix was acquired (±11 m, "Phone GPS").

## Drive notes

- The system permission dialog ignored `adb shell input tap`. Permissions were granted with `pm grant`.
- `expo run:android --device` takes a device name, not a serial number.
- `scripts/run-android.sh` sources `.env.android.local` after the caller's environment, so that file overrides an exported `EXPO_PUBLIC_USE_FIREBASE_EMULATOR`.
- A draft that has only camera photos makes no cache row. The row starts at Submission Details.
