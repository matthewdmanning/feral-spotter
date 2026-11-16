# Android camera configuration — synthesis

Decision summary of [2026-11-14-android-camera-config-guide.md](2026-11-14-android-camera-config-guide.md) ("GUIDE") and [2026-11-14-android-camera-capture-parameters.md](2026-11-14-android-camera-capture-parameters.md) ("REF").

- Goal: most real detail of a cat at 10–20 m, handheld, dusk or shade, subject may move. Output RAW-capable (DNG). Test device Pixel 7.
- Status: research only. Nothing run on a device. Every recommendation is inference (INF) from GUIDE's cited facts; `§n` = GUIDE section. Sources and quotes live in GUIDE, not here.

## Bottom line

1. The main dusk loss in current code is exposure capping, not resolution. Motion priority pins the fps range with the highest floor, capping auto exposure near 1/minFps (−1 to −2 EV vs a `[15, max]` range) without forcing a fast shutter (§4a).
2. Fix exposure explicitly: low-floor fps range plus an explicit shutter cap, metered on the cat (§4a–e).
3. Treat CameraX resolution selection as an output-size/capture-latency tradeoff: its higher-resolution pool still cannot select Android 12's maximum-resolution sensor pixel mode. That mode is a separate Camera2 choice; whether default/binned or maximum/unbinned is better for this device and scene requires measurement (§2a, §3).
4. Single gated DNG first. RAW burst stacking is the largest further gain but needs Camera2 (§9b). Night extension is JPEG-only and suits a still cat only (§9a).
5. Several defaults silently cost DNG quality: OIS not set, lens-shading map off (no GainMap), oversized tap-focus point under UI zoom (§5c, §6, §10b).

## Recommended configuration

| Area          | Setting                                                                                                                                               | Why                                                                                  | §        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Output        | `RAW_JPEG` where `getSupportedOutputFormats()` lists it; JPEG for review/ID, DNG for later processing                                                 | No benchmark shows single-DNG denoise beats the ISP JPEG; keep both                  | 10a, 10c |
| Sensor mode   | Camera2 `SENSOR_PIXEL_MODE` `DEFAULT` vs `MAXIMUM_RESOLUTION` (separate from CameraX `ResolutionSelector`)                                            | Default typically bins; maximum typically unbins. Measure noise/detail on device     | 3a       |
| Lens          | Clamp zoom ≥ 1.0; log active physical camera ID                                                                                                       | <1x = ultrawide; RAW pins the default physical camera                                | 3c       |
| FPS range     | `(≤15, max)`                                                                                                                                          | Session range is copied into still requests; a high floor caps exposure              | 4a       |
| Shutter       | API 36 + listed: `SENSOR_EXPOSURE_TIME_PRIORITY` at cap `t_max`. Else AE lock → `t = min(t_ae, t_max)`, `iso = iso_ae·t_ae/t` → AE OFF; lock AF first | Only way to bound subject-motion blur; OIS does not help it                          | 4b       |
| Shutter cap   | From `v·t/GSD ≤ 1–2 px`, GSD from runtime focal length and pixel array. DSLR walking-animal guidance (1/500 s) is an upper bound                      | Cat occupies few pixels at 10–20 m                                                   | 4d       |
| ISO           | Analog up to `SENSOR_MAX_ANALOG_SENSITIVITY`; beyond, keep ISO and push in post                                                                       | Digital gain adds no SNR; preserves highlights. Pixel 7 ISO invariance unknown       | 4c       |
| Metering      | AE region on the cat; −0.3 to −0.7 EV when highlights matter                                                                                          | Dark cat on bright ground underexposes                                               | 4e       |
| Flash / scene | `FLASH_MODE_OFF`; scene and extended scene modes off                                                                                                  | LED useless at 10–20 m (−6.6 to −8.6 EV); flash disables ZSL; HDR scene excludes RAW | 4g, 4h   |
| Focus         | Gate shutter on AF `PASSIVE_FOCUSED`/`FOCUSED_LOCKED` + `LENS_STATE == STATIONARY`; one trigger from `PASSIVE_SCAN`; never from `INACTIVE`            | `MINIMIZE_LATENCY` can capture mid-scan                                              | 5a–b     |
| Tap point     | Size `0.15 / uiZoom`, floor ~0.03–0.05; on AF failure fall back to far preset                                                                         | At 5x UI zoom, default point covers 75% of visible width                             | 5c       |
| Far preset    | Only on `CALIBRATED` lens: AF OFF, 0.067 D, check 0.05–0.10 D inside `LENS_FOCUS_RANGE`                                                               | `APPROXIMATE` drifts with orientation, age, temperature                              | 5d       |
| OIS           | ON explicitly via Camera2Interop on stills; verify in result                                                                                          | CameraX never sets it                                                                | 6        |
| Preview stab. | Off                                                                                                                                                   | Breaks framing vs DNG, takes OIS control                                             | 6        |
| ISP           | RAW bursts: FAST/OFF. Companion JPEG at high ISO: NR FAST/MINIMAL, edge OFF/FAST, as a setting. `SHADING_MODE` never OFF                              | NR smears fur; HQ makes stall indeterminate; `MAXIMIZE_QUALITY` does not request HQ  | 7        |
| Capture mode  | Moving cat: `MINIMIZE_LATENCY` + app gating. Still cat: `MAXIMIZE_QUALITY`                                                                            | Mode choice is 3A sequencing, not ISP quality; ZSL may return a pre-tap frame        | 8        |
| DNG metadata  | `STATISTICS_LENS_SHADING_MAP_MODE_ON`, `STATISTICS_HOT_PIXEL_MAP_MODE = true`; capture after AE/AWB converge                                          | Without the map CameraX's DNG has no GainMap                                         | 10b      |
| DNG writer    | App `DngCreator` for GPS + thumbnail, if CameraX exposes the matching `CaptureResult`                                                                 | CameraX writes orientation only                                                      | 10b      |
| Preview zoom  | RAW-only: sensor zoom (`setZoomRatio`). `RAW_JPEG`: keep UI transform; bigger preview stream only after `isSessionConfigSupported`                    | Sensor zoom crops the JPEG but not the DNG (no `CROPPED_RAW`)                        | 11       |
| Low-light     | Play-services Low Light Boost may brighten the viewfinder; warn preview ≠ DNG. AE-mode boost likely absent on Pixel 7                                 | AE-mode boost allows only two surfaces; excludes RAW                                 | 4i       |

## Changes against current code, by expected gain (INF)

| #   | Change                                          | Gain                               | Effort                                      | §      |
| --- | ----------------------------------------------- | ---------------------------------- | ------------------------------------------- | ------ |
| 1   | Gate and set RAW output (`setOutputFormat`)     | Enables every DNG item below       | Low                                         | 10a    |
| 2   | Low-floor fps range + explicit shutter cap      | +1–2 EV at dusk, bounded blur      | Medium (two code paths, API 36)             | 4a–b   |
| 3   | AF/lens-state shutter gating; scaled tap point  | Fewer focus misses at distance     | Low–medium                                  | 5      |
| 4   | OIS ON, lens-shading + hot-pixel maps ON        | Less shake; correct DNG shading    | Low (interop keys)                          | 6, 10b |
| 5   | Metering on subject region                      | Correct cat exposure               | Low (already passes subject region)         | 4e     |
| 6   | Sensor zoom for RAW-only mode                   | Real preview detail                | Low; product decision for JPEG              | 11     |
| 7   | Night extension as separate low-light JPEG mode | Large noise cut, still cat only    | Medium (rebind, countdown, postview)        | 9a     |
| 8   | Camera2 RAW burst, 4–8 frames, align + merge    | ≈ +6 dB at 4 frames (static areas) | High (Camera2 session, memory ~25 MB/frame) | 9b     |

## Open product decisions

| Decision                                | Options and consequence                                                                                                           | §     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Sensor zoom vs saved-JPEG field of view | ui-ux current-state says the sensor stays at 1x so the saved photo is full field. Sensor zoom keeps that for DNG only, crops JPEG | 11    |
| `RAW_JPEG` vs RAW-only                  | `RAW_JPEG` doubles writes (~25 MB DNG + JPEG) and may drop HDR+ from the JPEG; RAW-only loses the review JPEG                     | 8, 10 |
| Motion priority default                 | Current default caps dusk exposure; replacing it with a shutter cap changes Capture tuning mapping                                | 4a, 8 |
| Night mode                              | Separate JPEG-only mode; poor for moving cats; needs hold-still UX                                                                | 9a    |
| Burst stacking scope                    | Leaves CameraX `ImageCapture` for a Camera2 session; changes the Capture backend surface                                          | 9b    |

## Device tests that gate the plan

Ordered by what they unblock. Numbers = GUIDE §14.

1. `dumpsys media.camera` grep + `getprop ro.odm.build.media_performance_class`: settles capabilities, ranges, calibration, priority modes.
2. #1 RAW / `RAW_JPEG` listed — gates everything DNG.
3. #2, #3 fps range effect at dusk; range copied into stills on 1.7.0-alpha01 — gates change 2.
4. #5 blur px vs shutter at 10/15/20 m — sets `t_max`.
5. #9 HDR+ present in `RAW_JPEG` JPEG — settles the `RAW_JPEG` decision.
6. #12 OpcodeList2 with/without shading-map interop; #13 DNG at 1x/5x sensor zoom — confirm DNG changes.
7. #10 RAW min frame duration + stall — gates burst stacking.
8. #11 Night extension availability, keys, latency — gates Night mode.

## Evidence quality

- Official docs or source: all API behavior rows in GUIDE §2–12.
- Weaker, flagged in GUIDE: Pixel 7 sensor model (2022 code leak); Pixel CameraX Night requirement (mailing-list reply); 50 MP unavailability (press + one forum report); DSLR shutter guidance (retailer guide).
- CameraX source read from `androidx-main`, not the pinned 1.6.2 / 1.7.0-alpha01.
- Unresolved conflicts: GUIDE §15 (`setLockingMode` version, `EXTENSION_STRENGTH` 100 meaning, Night Sight frame count, aperture).
