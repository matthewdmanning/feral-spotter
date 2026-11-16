# Android camera configuration guide — detail in blur, shade and low light

Settings grouped by function, with their effect on output and performance.

- Goal: most real detail of a cat at 10–20 m. Handheld. Dusk or shade. Subject may move.
- Fixed: output is RAW-capable (DNG). Preview must zoom; any implementation is allowed.
- Stack: CameraX (`ProcessCameraProvider` + `SessionConfig`, compiled against 1.6.2, resolved to 1.7.0-alpha01) with Camera2Interop. Test device: Pixel 7.
- Companion doc: [2026-11-14-android-camera-capture-parameters.md](2026-11-14-android-camera-capture-parameters.md) ("REF"). It lists the control values and exclusive groups. This guide does not repeat them; it adds effects, mechanisms and choices.
- Status: research only. Nothing here was run on a device. Every "do" line is a recommendation, not a verified result.

## How to read

| Mark            | Meaning                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `[O-…]`         | Official doc text, read in full                                                                           |
| `[X-…]`         | androidx source, `androidx-main` branch. May differ from 1.6.2 / 1.7.0-alpha01.                           |
| `[A-…]`         | AOSP source or HAL header (GitHub mirror)                                                                 |
| `[P-…]`         | Paper or Google research text                                                                             |
| `[S-…]`         | Secondary source (press, OEM marketing, project README, forum)                                            |
| `[D-…]`         | This repository                                                                                           |
| **†**           | Not verified: the page refused scripted reads (HTTP 403) or the claim was not found. Treat as a lead.     |
| **INF**         | Inference from the cited facts. Not stated by any source.                                                 |
| **DEVICE TEST** | Not settled by documentation. Settle on hardware. All tests are collected in [§14](#14-device-test-plan). |

Sources are in [§16](#16-sources).

---

## 1. What destroys detail, and which group fixes it

| Loss mechanism      | Cause                                         | Primary groups                                      |
| ------------------- | --------------------------------------------- | --------------------------------------------------- |
| Noise               | Too few photons: short exposure, dim scene    | Exposure (§4), multi-frame (§9)                     |
| Hand-shake blur     | Camera rotates during exposure                | Stabilization (§6), exposure cap (§4)               |
| Subject-motion blur | Cat moves during exposure                     | Exposure cap (§4). OIS does **not** help [O-CR].    |
| Focus miss          | AF hunts in low contrast; lens moving at shot | Focus (§5)                                          |
| Processing loss     | NR smears fur; sharpening halos               | ISP processing (§7). RAW avoids most of it (§10).   |
| Resolution ceiling  | Binned sensor; digital zoom is a crop         | Sensor mode (§3), multi-frame super-resolution (§9) |
| Shadow loss         | Underexposed dark subject; bright background  | Metering (§4), DNG shading map (§10)                |

Core trade: exposure time buys photons (less noise) and costs blur. Every group below moves along that trade or escapes it (OIS, multi-frame, metering).

---

## 2. Hard constraints from "RAW-capable"

Each row rules something out. Sources in the linked section.

| Constraint                                                                                           | Consequence                                                                  | §      |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Extensions (Night, HDR, Auto) output JPEG/YUV/JPEG_R only. CameraX refuses non-JPEG with extensions. | Night is a separate JPEG mode, never a RAW modifier.                         | 9a     |
| `CONTROL_SCENE_MODE_HDR` does not support RAW.                                                       | No scene HDR.                                                                | 4h     |
| Low-light-boost AE mode allows only two preview/encoder surfaces.                                    | Not combinable with a still RAW stream.                                      | 4i     |
| RAW is not cropped by zoom without `CROPPED_RAW`. Pixel 7 lacks it [D-REF §10].                      | DNG is always full field of view on Pixel 7, whatever the zoom.              | 11     |
| With a RAW stream configured, a logical multi-camera stays on its default physical camera.           | No lens switch on zoom while RAW is bound.                                   | 3c     |
| CameraX cannot select max-resolution (unbinned) sizes.                                               | 50 MP needs a Camera2 session, and may not exist for third-party apps (§3b). | 3b     |
| CameraX `ImageCapture` is single-shot.                                                               | RAW bursts need Camera2 `captureBurst` or a ZSL ring buffer.                 | 9b     |
| Guaranteed RAW stream sets cap preview/analysis streams at PREVIEW size (≤1080p) on FULL devices.    | Bigger preview or analysis streams need a support probe.                     | 2a, 11 |

### 2a. Stream budget

| Combination                                       | Guaranteed on                                | Source |
| ------------------------------------------------- | -------------------------------------------- | ------ |
| `PRIV PREVIEW + RAW MAX`                          | RAW capability (LIMITED, FULL)               | [O-CD] |
| `PRIV PREVIEW + JPEG MAX + RAW MAX`               | RAW capability ("simultaneous JPEG and DNG") | [O-CD] |
| `PRIV PREVIEW + YUV PREVIEW + RAW MAX`            | RAW capability                               | [O-CD] |
| `PRIV PREVIEW + PRIV 640x480 + YUV MAX + RAW MAX` | LEVEL_3 only                                 | [O-CD] |

- PREVIEW = screen size or 1080p, whichever is smaller [O-CD].
- Pixel 7 is FULL [D-REF §10]. So Preview + ImageCapture(`RAW_JPEG`) is guaranteed. A fourth stream (ImageAnalysis) is not.
- Outside the tables, a session may work, may miss frame-rate guarantees, or may fail [O-CD].
- Probe with CameraX `CameraInfo.isSessionConfigSupported(SessionConfig)` (1.6.0) before binding [O-CI].
- Frame rate of the whole session "is governed only by the largest requested stream resolution" [O-CR `SENSOR_FRAME_DURATION`]. A max-size RAW stream sets the sensor mode for preview too.

### 2b. Stall and shot-to-shot time

- JPEG, RAW16 (`RAW_SENSOR`) and RAW_PRIVATE "may always have a stall duration". YUV and PRIVATE never stall [O-SCM].
- A stalling request "will not have an exposure start until the stall has completed" [O-SCM].
- Any processing mode at `HIGH_QUALITY` makes the stall "indeterminate" for every stream in the request, RAW included [O-SCM].
- `BURST_CAPTURE` guarantees ≥20 fps for ≥8 MP YUV with FAST processing, and RAW10/12/14 at that rate. It does **not** name `RAW_SENSOR` [O-CM].
- Shot interval ≈ min frame duration + largest stall. Read both with `getOutputMinFrameDuration` and `getOutputStallDuration` per size. **DEVICE TEST.**

---

## 3. Sensor mode and resolution

### 3a. Binned vs maximum-resolution

| Control                                                   | API | Effect                                                                                                    | Source |
| --------------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------- | ------ |
| `SENSOR_PIXEL_MODE` = `DEFAULT`                           | 31  | Sensor "would typically perform pixel binning in order to improve low light performance, noise reduction" | [O-CR] |
| `SENSOR_PIXEL_MODE` = `MAXIMUM_RESOLUTION`                | 31  | "Typically operate in unbinned mode allowing for a larger image size"                                     | [O-CR] |
| Capability `ULTRA_HIGH_RESOLUTION_SENSOR`                 | 31  | Gates the max-resolution mode. Pixel array ≥24 MP.                                                        | [O-CM] |
| Mixing default and max-res outputs                        | 31  | Not allowed in one request, unless a size is in both maps. Each max-res shot is its own request.          | [O-CR] |
| `SCALER_MANDATORY_MAXIMUM_RESOLUTION_STREAM_COMBINATIONS` | 31  | Null when the device has no ultra-high-resolution sensor. Cheap probe.                                    | [O-CC] |

Low-light cost of unbinned output:

- 2×2 binning gives about 6 dB SNR when read-noise-limited. Full-resolution mode "is typically not used in low light" [P-BIN].
- Max-res RAW is usually a remosaiced (synthesized) Bayer, not photosite data [O-CM `REMOSAIC_REPROCESSING`].
- A quad-pattern RAW appears only in a RAW-only max-res request on a remosaic-reprocessing device. `SENSOR_INFO_COLOR_FILTER_ARRANGEMENT` cannot describe a quad pattern [O-CC]. Check `SENSOR_INFO_BINNING_FACTOR` and `SENSOR_RAW_BINNING_FACTOR_USED` before writing a DNG [O-CC][O-CRes].
- Samsung: in low light "16 pixels merge together to function as a 12.5MP sensor". Conventional 50 MP sensors are "typically limited to maintaining 12.5MP resolution at 2x zoom" [S-SAM].

**Do (INF):** use `DEFAULT` (typically binned) as the low-light baseline; compare
it with `MAXIMUM_RESOLUTION` on the target device before claiming a noise or
detail advantage.

### 3b. Pixel 7 specifics

| Fact                                                                                                                                                                | Source         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Main: 50 MP, 1/1.31", 1.2 µm, dual-pixel PDAF, OIS. Aperture f/1.85 (TechAdvisor) or f/1.9 (GSMArena). 82° FoV. 8x Super Res Zoom.                                  | [S-PX7]        |
| Main sensor Samsung GN1; ultrawide Sony IMX381. Pre-launch leak: IDs matched from camera HAL code. Not an official spec.                                            | [S-GN1, leak]  |
| Ultrawide: 12 MP, f/2.2, 114°, 1/2.9", 1.25 µm                                                                                                                      | [S-PX7]        |
| **No telephoto.** GSMArena lists a dual camera. Any zoom >1x is a crop of the main sensor.                                                                          | [S-PX7]        |
| "Recent flagship Pixels … shoot at 12.5MP as they use pixel-binning by default … Google doesn't let you shoot at the full 50MP resolution" (Pixel Camera app, 2023) | [S-PX50]       |
| Pixel 8 Pro: Open Camera "would only let me select up to 12 MP"; Pixel Camera offered 50 MP (one user report)                                                       | [S-GOS, forum] |
| CameraX `ResolutionSelector`: max-res sizes — "This mode does not allow applications to select those ultra high resolutions"                                        | [O-RS]         |

- Hypothesis: RAW may be about 12.5 MP binned. **DEVICE TEST:** read `pixelArraySize`, capabilities and RAW_SENSOR sizes.
- Binned effective pixel ≈ 2.4 µm (INF: 2×2 of 1.2 µm).

### 3c. Multi-camera and lens switching

- `CONTROL_ZOOM_RATIO` combines optical and digital zoom and can switch lenses on a logical camera [O-CR].
- With RAW configured, the default physical camera "remains active and does not switch". This "usually results in loss of optical zoom" [O-CM `LOGICAL_MULTI_CAMERA`].
- `MultiResolutionImageReader` (API 31, Camera2 only) gives RAW from the active physical camera [O-CM].
- Under a lock, exposure and lens values "may change" when the physical camera switches [O-CM `MANUAL_SENSOR`].
- Zoom <1x on Pixel 7 means the ultrawide [S-PX7]. Whether it has AF is unverified; read `LENS_INFO_MINIMUM_FOCUS_DISTANCE` (0 = fixed focus) [O-CC].

**Do (INF):** clamp zoom ≥1.0. Log `LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID` per shot (API 29) [O-CRes].

---

## 4. Exposure

### 4a. Frame-rate range caps exposure (current-code issue)

| Fact                                                                                                                                                                            | Source   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `CONTROL_AE_TARGET_FPS_RANGE` bounds how AE may change frame rate. It "only constrains auto-exposure … not manual control".                                                     | [O-CR]   |
| Frame duration is capped to `max(duration, exposureTime + overhead)`.                                                                                                           | [O-CR]   |
| `SessionConfig`: a dynamic range such as [15, 30] allows "longer exposures for brighter, less noisy images". A fixed [30, 30] "can lead to darker, noisier video in low light". | [O-SC]   |
| CameraX copies the session fps range into **still-capture** requests too (unit test asserts it).                                                                                | [X-SCRT] |
| LIMITED+ devices always list `(min, max)` and `(max, max)` with `min ≤ 15`.                                                                                                     | [O-CC]   |

- Current code: with motion priority on, it pins the supported range with the highest lower bound [D-CT][D-CODE `buildSessionConfig`]. Motion priority is on by default [D-CT].
- Effect (INF): auto exposure ≤ ~1/minFps. [30,30] caps it near 33 ms; [60,60] near 16.7 ms. That is −1 to −2 EV against a [15,30] floor at dusk.
- The floor does **not** force a fast shutter. It only bounds the slowest one. 1/30 s still blurs a walking cat (INF from §4d).
- `MINIMIZE_LATENCY` and ZSL skip AE precapture, so the photo inherits the capped preview exposure [X-CP].
- **DEVICE TEST:** confirm the still-request copy on 1.7.0-alpha01. Log exposure at dusk for both ranges.

**Do (INF):** use a low-floor range `(≤15, max)`. Enforce the shutter cap explicitly (§4b).

### 4b. Ways to set the shutter

| Method                                                       | API    | Behavior                                                                                                                          | Source                   |
| ------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| AE `ON` (default)                                            | 21     | AE overrides exposure, ISO, frame duration. Values appear in the result.                                                          | [O-CR]                   |
| `CONTROL_AE_PRIORITY_MODE` = `SENSOR_EXPOSURE_TIME_PRIORITY` | **36** | App fixes the shutter; AE picks ISO. Optional: check `CONTROL_AE_AVAILABLE_PRIORITY_MODES`. Not with the low-light-boost AE mode. | [O-CR][O-CC]             |
| `CONTROL_AE_PRIORITY_MODE` = `SENSOR_SENSITIVITY_PRIORITY`   | 36     | App fixes ISO; AE picks shutter.                                                                                                  | [O-CR]                   |
| AE `OFF` (manual)                                            | 21     | App sets exposure, ISO, frame duration. Needs `MANUAL_SENSOR` (FULL has it). AF/AWB become "device dependent".                    | [O-CM][O-CR]             |
| Lock → copy → manual                                         | 21     | Google's documented recipe: lock AE, read result, switch to OFF with those values.                                                | [O-CR `CONTROL_AE_LOCK`] |
| `CONTROL_CAPTURE_INTENT_MOTION_TRACKING`                     | 28     | AE limits exposure to ≤20 ms. Needs the rare `MOTION_TRACKING` capability.                                                        | [O-CR]                   |

- Manual exposure that is impossible is shortened, never lengthened [O-CR `SENSOR_EXPOSURE_TIME`].
- FULL guarantees exposure range <100 µs to >100 ms and ISO ≥100–800 [O-CC].
- In CameraX, set these through `Camera2CameraControl.setCaptureRequestOptions` (repeating and still) or per-use-case `camera2Interop`. Interop overrides CameraX's own values [O-CX2].

**Do (INF):**

1. API 36 and listed: shutter priority with cap `t_max`.
2. Otherwise: AE lock → read `t_ae`, `iso_ae` → AE OFF with `t = min(t_ae, t_max)`, `iso = iso_ae × t_ae / t`, clamped to the analog maximum (§4c).
3. Lock AF first when AE is OFF [O-CR `CONTROL_AF_MODE`].

### 4c. ISO and noise in RAW

| Fact                                                                                                                                                                                      | Source       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Below `SENSOR_MAX_ANALOG_SENSITIVITY`, gain is "only analog". Above it, a mix of analog and digital.                                                                                      | [O-CR][O-CC] |
| `POST_RAW_SENSITIVITY_BOOST` never affects RAW. Copy it too when matching auto ISO in a manual request.                                                                                   | [O-CR]       |
| `SENSOR_NOISE_PROFILE` gives per-channel `N(x) = sqrt(S·x + O)`: S shot-noise, O read-noise term.                                                                                         | [O-CRes]     |
| Photon (shot) noise "has nothing to do with your camera". ISO-invariant camera: brightening in post shows the same noise as higher ISO, and keeps highlights. Pixel 7 invariance unknown. | [S-ISO]      |

**Do (INF):** raise analog ISO up to `SENSOR_MAX_ANALOG_SENSITIVITY`. Beyond that, keep ISO and push in post: same noise, more highlight room. Find the real read-noise floor by plotting O against ISO on the device. **DEVICE TEST.**

### 4d. Choosing the shutter cap

- DSLR wildlife guidance: walking animal ≈1/500 s; running dog 1/1000–1/2000 s; birds or cheetahs 1/2000–1/4000 s [S-WL]. Frame-filling subjects; an upper bound here.
- Blur in pixels ≈ `v · t / GSD`. GSD (metres per pixel at distance d) ≈ `d · pixelPitch / focalLength` (INF, thin-lens geometry).
- Read focal length, physical size and pixel array at runtime: `LENS_INFO_AVAILABLE_FOCAL_LENGTHS`, `SENSOR_INFO_PHYSICAL_SIZE`, `SENSOR_INFO_PIXEL_ARRAY_SIZE` [O-CC].
- Target ≤1–2 px of blur at the expected cat speed. Calibrate on a moving target at 10/15/20 m. **DEVICE TEST.**
- Google treats ≤20 ms as a blur-limiting cap for motion tracking [O-CR].

### 4e. Metering

| Control                                   | Effect                                                                                                          | Source        |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------- |
| `CONTROL_AE_REGIONS`                      | Weighted [0,1000] regions. Outside the crop region they are ignored. From API 30 they follow zoom coordinates.  | [O-CR]        |
| CameraX `FocusMeteringAction` + `FLAG_AE` | Tap-to-meter. Default modes AF+AE+AWB; auto-cancel 5 s.                                                         | [O-FMA]       |
| `FocusMeteringAction.setLockingMode`      | Update regions without locking. **Not in 1.7.0-alpha01** (alpha02 per release notes; reference page says rc02). | [O-RN][O-FMA] |
| `CONTROL_AE_EXPOSURE_COMPENSATION`        | EV steps of `CONTROL_AE_COMPENSATION_STEP`. Works even under AE lock. Ignored with AE OFF.                      | [O-CR]        |
| `CONTROL_AE_LOCK`                         | Freezes exposure. Locked values may differ from the latest result.                                              | [O-CR]        |
| `CONTROL_AE_PRECAPTURE_TRIGGER`           | Final metering before a quality still. Adds latency.                                                            | [O-CR]        |

**Do (INF):**

- Meter on the cat, not the scene. A dark cat against bright ground underexposes under default metering.
- Use −0.3 to −0.7 EV when highlights matter. Check clipping against per-frame `SENSOR_DYNAMIC_WHITE_LEVEL` [O-CRes].
- With UI-only zoom, compute regions in full-frame coordinates (§5c).

### 4f. Shadows

- Tonemap modes (`GAMMA_VALUE`, `PRESET_CURVE`, `CONTRAST_CURVE`) lift shadows in preview/JPEG only [O-CR].
- No doc line says tonemap leaves RAW untouched. RAW_SENSOR is defined as the Bayer mosaic (INF that tonemap does not apply). **DEVICE TEST:** diff DNGs.
- For DNG shadows, only exposure time and analog gain raise SNR (INF from §4c).
- Ultra HDR (`JPEG_R`) gain maps mostly extend highlights; shadows come from the SDR base [O-HDRF]. Not a shadow tool.

**Do (INF):** a brighter preview tonemap is fine as a viewfinder aid. Do not expect it in the DNG.

### 4g. Flash and torch

- Inverse square: from 1 m to 10/15/20 m light drops 6.6/7.8/8.6 EV (INF, physics).
- Phone LEDs act like continuous light, so a guide number does not apply directly. "The smartphone flash is only useful at very near ranges in a very dark environment" [S-LED, Stack Exchange repost].
- Any flash mode except OFF disables ZSL [D-REF §5a].
- `FLASH_STRENGTH_LEVEL` (API 35) sets power where supported [O-CR].

**Do (INF):** no flash or torch for 10–20 m. Leave `FLASH_MODE_OFF`.

### 4h. Scene modes

- Scene modes other than FACE_PRIORITY disable the app's AE, AWB and AF. Behavior "will not be consistent across all devices" [O-CR].
- `HDR` excludes RAW [O-CM].
- `CONTROL_EXTENDED_SCENE_MODE` BOKEH blurs non-RAW backgrounds and may limit zoom [O-CR][O-CC].

**Do:** leave scene mode and extended scene mode off.

### 4i. Low-light boost

| Variant                                                                               | Where                                     | Effect                                                                                                 | Source           |
| ------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| AE mode `ON_LOW_LIGHT_BOOST_BRIGHTNESS_PRIORITY` / CameraX `enableLowLightBoostAsync` | API 35; "currently available on Pixel 10" | Ignores fps target down to 10 fps. Can exceed the normal ISO range. Two preview/encoder surfaces only. | [O-CM][O-LLB]    |
| Google Low Light Boost (Play services, beta)                                          | Pixel 6–9, some Samsung                   | Software brightening of the **preview** surface only. Keeps frame rate. Does not touch captures.       | [O-LLB][O-LLBGP] |

- Low light boost has "more artifacts and more motion blur" than Night [O-LLB].
- Current code can disable the AE-mode boost via a prop [D-CODE].

**Do (INF):** Pixel 7 likely lacks the AE mode (query `isLowLightBoostSupported`). Google LLB can brighten the dusk viewfinder. Warn that the preview then looks brighter than the DNG.

---

## 5. Focus

### 5a. AF modes and state

| Item                                   | Behavior                                                                 | Source        |
| -------------------------------------- | ------------------------------------------------------------------------ | ------------- |
| `CONTINUOUS_PICTURE` (CameraX default) | "Focusing as fast as possible". A trigger finishes any scan, then locks. | [O-CM][X-FMC] |
| `AUTO`                                 | Lens moves only on trigger. Cancel resets lens to default.               | [O-CM]        |
| `MACRO`                                | Close subjects. Wrong for 10–20 m.                                       | [O-CM]        |
| `OFF`                                  | App sets `LENS_FOCUS_DISTANCE`.                                          | [O-CM]        |
| Trigger in `PASSIVE_FOCUSED`           | Immediate `FOCUSED_LOCKED`. No lag.                                      | [O-CRes]      |
| Trigger in `PASSIVE_SCAN`              | Waits for the scan, then locks or fails.                                 | [O-CRes]      |
| Trigger in `INACTIVE`                  | Immediate `NOT_FOCUSED_LOCKED`.                                          | [O-CRes]      |
| `PASSIVE_FOCUSED`                      | Transient; may rescan any time. Only `FOCUSED_LOCKED` holds the lens.    | [O-CM]        |
| `LENS_STATE`                           | `MOVING` while focus (or other lens parameters) change.                  | [O-CRes]      |
| Repeated `AF_TRIGGER START`            | Restarts AF every frame: hunting.                                        | [O-CR]        |

### 5b. CameraX capture mode and focus

- `MAXIMIZE_QUALITY` locks AF after the current scan; 3A timeout 1 s [X-CP].
- `MINIMIZE_LATENCY` (no flash) does no AF lock. It can capture mid-scan [X-CP].

**Do (INF):** gate the shutter in the app. Capture when AF state is `PASSIVE_FOCUSED`/`FOCUSED_LOCKED` and `LENS_STATE == STATIONARY`. In `PASSIVE_SCAN`, send one trigger and capture on lock. Never trigger from `INACTIVE`.

### 5c. Tap-to-focus at distance

| Fact                                                                                                | Source         |
| --------------------------------------------------------------------------------------------------- | -------------- |
| Default `MeteringPoint` size 0.15 of sensor (or crop region) width/height.                          | [O-MPF][X-MPF] |
| AF/AE/AWB regions follow `CONTROL_ZOOM_RATIO` coordinates (API 30). Not applicable to RAW metadata. | [O-CR]         |
| `FLAG_AF` switches AF to `AUTO` and locks. Auto-cancel returns to continuous after 5 s.             | [X-FMC][O-FMA] |
| Failed focus → `isFocusSuccessful = false` after up to 5 s.                                         | [X-FMC][O-RN]  |
| Points beyond `CONTROL_MAX_REGIONS_AF` are ignored.                                                 | [O-MPF]        |

- Current code: default point size, `FLAG_AF | FLAG_AE`, on tap and on localizer subject region [D-CODE `focusPreviewPoint`].
- With UI-only zoom, the camera stays at 1x. At the 5x UI maximum [D-VZ], a 0.15 point covers 75% of the visible width (INF). It can lock on grass.

**Do (INF):** create the point with size `0.15 / uiZoom`, floor ~0.03–0.05. If AF fails, fall back to the far preset (§5d).

### 5d. Manual far-focus preset

| Fact                                                                                                          | Source   |
| ------------------------------------------------------------------------------------------------------------- | -------- |
| `LENS_FOCUS_DISTANCE` in diopters; 0 = infinity. Clamped to `[0, minimumFocusDistance]`. Needs MANUAL_SENSOR. | [O-CR]   |
| Diopters are physical only if `LENS_INFO_FOCUS_DISTANCE_CALIBRATION` is `APPROXIMATE` or `CALIBRATED`.        | [O-CC]   |
| Even `APPROXIMATE` drifts with "orientation … age … temperature". Only `CALIBRATED` is repeatable.            | [O-CM]   |
| `LENS_INFO_HYPERFOCAL_DISTANCE` is reported only when calibrated; its circle of confusion is undocumented.    | [O-CC]   |
| `LENS_FOCUS_RANGE` (result) gives the in-focus band (near, far) in diopters.                                  | [O-CRes] |

- 10–20 m = 0.10–0.05 D; 15 m ≈ 0.067 D (arithmetic).

**Do (INF):** only on a calibrated lens: AF OFF, focus 0.067 D, wait for `STATIONARY`, confirm 0.05–0.10 D lies inside `LENS_FOCUS_RANGE`. Hyperfocal may be soft at 100% crop. Disable the preset with a clip-on lens.

---

## 6. Stabilization and shake

| Control                                                      | API    | Effect                                                                                                                  | Source                        |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `LENS_OPTICAL_STABILIZATION_MODE` = ON                       | 21     | Allows "longer exposure times before camera shake becomes apparent". May need frames to settle. No subject-motion help. | [O-CR]                        |
| OIS + digital video stabilization                            | 21     | "Not recommended" together.                                                                                             | [O-CR]                        |
| `CONTROL_VIDEO_STABILIZATION_MODE` = `PREVIEW_STABILIZATION` | 33     | Stabilizes preview and all non-RAW streams. Up to 20% FOV loss per axis. **RAW untouched.** Overrides app OIS setting.  | [O-CM][O-CR]                  |
| CameraX `Preview.Builder.setPreviewStabilizationEnabled`     | CX 1.4 | Same mode, preview and video.                                                                                           | [O-PB]                        |
| CameraX OIS                                                  | —      | No androidx-main code sets OIS. Stills get the HAL template default.                                                    | [X-CS] (INF from code search) |
| `STATISTICS_OIS_DATA_MODE`                                   | 28     | Per-frame OIS samples, for blur estimation. Optional.                                                                   | [O-CR]                        |

Gyro shake gate:

- Apps targeting API 31+ get ≤200 Hz without `HIGH_SAMPLING_RATE_SENSORS` [O-SENS].
- `SensorEvent.timestamp` uses the `elapsedRealtimeNanos` base [O-SENS].
- With `SENSOR_INFO_TIMESTAMP_SOURCE_REALTIME`, camera timestamps share that base. Exposure window = `[SENSOR_TIMESTAMP, + exposure + rolling-shutter skew]` [O-CM][O-CRes].

**Do (INF):**

- Set OIS ON explicitly via Camera2Interop on the still request; verify in the result.
- Keep preview stabilization off. It breaks WYSIWYG framing against the DNG and takes OIS control.
- Optional: integrate gyro rate over the exposure window. Delay or flag shots above a threshold. Calibrate with OIS on. **DEVICE TEST.**

---

## 7. ISP processing — JPEG vs RAW

| Block                              | JPEG/YUV effect                                                                                                                                                 | RAW effect                                                                | Source           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------- |
| `NOISE_REDUCTION_MODE`             | Removes noise "especially in dark conditions". FAST/HQ are vendor-tuned. Texture and noise "usually work against each other".                                   | OFF = none; MINIMAL = raw-domain basic. FAST/HQ unspecified.              | [O-CR][S-DXO]    |
| `EDGE_MODE`                        | Sharpening. Large overshoots cause halos that "may look good in small displays such as camera phones, but can become glaringly obvious at high magnifications". | Docs silent.                                                              | [O-CR][S-IMA]    |
| `SHADING_MODE`                     | Corrects vignetting/color shading; corner gain raises corner noise.                                                                                             | If OFF, the shading map becomes identity.                                 | [O-CR][O-CRes]   |
| `COLOR_CORRECTION_ABERRATION_MODE` | Removes color fringes. HQ may lower capture rate.                                                                                                               | Docs silent (INF: processed only).                                        | [O-CRes][O-CM]   |
| `DISTORTION_CORRECTION_MODE`       | On by default where supported. Uses `activeArraySize`.                                                                                                          | "Not applied to any RAW output". RAW uses `preCorrectionActiveArraySize`. | [O-CR][O-CC]     |
| `TONEMAP_MODE`                     | Global curves only; app curve lifts noise with shadows.                                                                                                         | Docs silent (§4f).                                                        | [O-CR]           |
| `COLOR_CORRECTION_MODE`            | WB/color rendering.                                                                                                                                             | RAW color is set in the converter from DNG matrices (§10).                | [O-CM]           |
| `HOT_PIXEL_MODE`                   | Removes stuck pixels.                                                                                                                                           | Hot-pixel map can become DNG BadPixel opcodes (§10).                      | [O-CR][A-DNGJNI] |

- HAL rule: FAST "must always be included"; HQ only if a better slow mode exists; OFF only if the block can be disabled [A-HAL].
- `HIGH_QUALITY` anywhere makes stall indeterminate (§2b).
- HAL RAW16: "raw Bayer-pattern images from an image sensor, with minimal processing" — not "unprocessed" [A-HAL-GFX].

**Do (INF):**

- RAW bursts: FAST or OFF on all blocks.
- Companion JPEG at high ISO: NR FAST/MINIMAL and edge OFF/FAST keep fur texture. Expose as a setting; it is vendor-tuned.
- Do not set `SHADING_MODE` OFF.
- Map crops between JPEG and RAW with the right array size.

---

## 8. Capture mode and template

| Fact                                                                                                                       | Source                        |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| CameraX uses `TEMPLATE_STILL_CAPTURE` for stills in every capture mode.                                                    | [X-CCA]                       |
| `MAXIMIZE_QUALITY`: AE precapture on flash-unit devices (Pixel 7 has one); otherwise AF lock + AWB wait. JPEG quality 100. | [X-CP][X-IPL]                 |
| No androidx-main writes of `NOISE_REDUCTION_MODE` or `EDGE_MODE`. **MAXIMIZE_QUALITY does not request HQ NR/edge.**        | [X-CS] (INF from code search) |
| CameraX Pixel quirk: `TEMPLATE_STILL_CAPTURE` "enables the HDR+" for stills on Pixel phones.                               | [X-Q]                         |
| Pixel 2/3 sample: HDR+ applies only to requests with only JPEG/YUV outputs, and needs `CONTROL_ENABLE_ZSL`.                | [S-GP]                        |
| `CONTROL_ENABLE_ZSL` (API 26): device "may use images captured in the past". Result metadata may be out of order.          | [O-CR]                        |

- Current mapping: both priorities default true → `ZERO_SHUTTER_LAG` [D-CT].
- INF: on Pixel 7, a `RAW_JPEG` request may drop the JPEG to single-frame processing. **DEVICE TEST:** JPEG-only vs RAW_JPEG JPEG, same scene and ISO.
- Device ZSL may return a frame from before the tap: wrong if the cat just moved. Check `SENSOR_TIMESTAMP`.

**Do (INF):** `MINIMIZE_LATENCY` + app gating (§5b) for a moving cat. `MAXIMIZE_QUALITY` for a still cat. Mode choice is about 3A sequencing, not ISP quality. Force NR/edge via Camera2Interop if wanted.

---

## 9. Multi-frame

### 9a. Vendor extensions (Night, HDR, Auto)

| Fact                                                                                                                                                                                                     | Source          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Extension still formats: JPEG, YUV_420_888, JPEG_R, P010, DEPTH_JPEG. **No RAW.** At most two surfaces.                                                                                                  | [O-CEC][O-CES]  |
| Extension "is allowed to override all capture parameters".                                                                                                                                               | [O-CES]         |
| CameraX with extensions: only JPEG (+ Ultra HDR where offered). "Cannot set non-JPEG buffer format with Extensions enabled."                                                                             | [X-IC]          |
| Night "takes several photos … can take several seconds … user should hold the phone still".                                                                                                              | [O-EXT]         |
| Pixel 7 is in the supported-devices list; the list does not say which extensions.                                                                                                                        | [O-SD]          |
| "Pixel 6 and above support night mode CameraX Extensions since Android 14 (A Pixel-Camera-Service apk update is required if it's before QPR1)." Scott Nien, 2024-01-26; mailing list, not official docs. | [S-PCS, forum]  |
| MPC (Android 15 CDD) adds a Night mode extension requirement via CameraX and Camera2 (7.5/H-1-15).                                                                                                       | [O-CDD]         |
| Zoom/AF keys in Night are mandatory only on devices launching on Android 15+. Pixel 7 launched earlier.                                                                                                  | [O-CEC]         |
| `EXTENSION_STRENGTH` (API 34) controls frames fused. Camera2 says 100 = max; CameraX says 100 = default. **Conflict.**                                                                                   | [O-CR][O-CXEXT] |
| Latency estimate, postview and progress callbacks exist (API 34; CameraX 1.4).                                                                                                                           | [O-CEC][O-IC]   |
| CameraX ≤1.5 loses extension support on some devices from 2026-11-01; 1.6+ keeps it.                                                                                                                     | [O-EXT]         |

**Do (INF):** offer Night as a separate "low-light JPEG" mode that rebinds the session. Query `isExtensionAvailable(NIGHT)`, zoom/AF keys and latency. Show a hold-still countdown and postview. Poor fit for a moving cat.

### 9b. App-side RAW burst stacking

Method facts:

| Fact                                                                                                                                                                                                                     | Source        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| HDR+: constant exposure, set "low enough to avoid blowing out highlights". Raw input avoids "the ISP's unwanted tone mapping and spatial denoising". 2.5–4 s on device for a low-light 12 MP shot.                       | [P-HDRP]      |
| HDR+ dataset bursts: 2–10 raw frames. Rolling-shutter readout 1/30 s.                                                                                                                                                    | [P-HDRD]      |
| Night Sight: motion metering picks frame count and per-frame exposure "that together minimize both noise and motion blur". Works to 0.3 lux.                                                                             | [P-NS]        |
| Night Sight blog: 6 frames on tripod, up to 15 handheld. Per-frame exposure ≤333 ms handheld with little motion. Range: "15 frames of 1/15 second (or less) each, or 6 frames of 1 second each, or anything in between". | [P-NSB]       |
| Night Sight paper: 6–13 frames; ≤333 ms per frame handheld, ≤1 s stabilized. (Blog says up to 15.)                                                                                                                       | [P-NS]        |
| Default ZSL "intrinsically limits exposure time": HDR+ ZSL frames cap at 66 ms. Night Sight uses positive shutter lag. Motion metering example: 73 ms → 48 ms.                                                           | [P-NSB]       |
| Handheld super-resolution uses hand tremor for sub-pixel shifts; raises resolution and SNR. ~100 ms per 12 MP input frame on phone GPU. Default merge in Night Sight.                                                    | [P-SR]        |
| Independent re-implementations report errors in the super-resolution paper.                                                                                                                                              | [S-SRIMPL]    |
| MotionCam (open source, Android): raw ZSL burst, optical-flow align, pyramid fusion, Halide; night cap ≈1/3 s.                                                                                                           | [S-MC]        |
| N independent frames cut noise std by √N: 4 frames ≈ +6 dB, 15 ≈ +11.8 dB (static regions).                                                                                                                              | INF; [P-HDRP] |

API facts:

| Fact                                                                                                                                                          | Source                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `captureBurst` runs requests "in the minimum amount of time possible", not interleaved.                                                                       | [O-CCS]                   |
| CameraX `ImageCapture` has no burst method.                                                                                                                   | [O-IC] (INF from absence) |
| `BURST_CAPTURE` locks AE/AWB "so burst capture … yields consistent image output". No RAW_SENSOR rate.                                                         | [O-CM]                    |
| YUV reprocessing with `REPROCESS_EFFECTIVE_EXPOSURE_FACTOR` (≤√N) is the official app-merge + ISP path. Output YUV/JPEG only; exclusive with DNG per request. | [O-CR][O-CD][A-HAL]       |
| Memory: 12.5 MP RAW_SENSOR ≈25 MB; 15 frames ≈375 MB before merge workspace.                                                                                  | INF from [O-IF]           |

**Do (INF):**

- Stage 1: single DNG with good gating (§4–6). Keep it as the moving-cat fallback.
- Stage 2: Camera2 RAW burst, 4–8 frames, AE/AWB locked, constant short exposure, FAST processing. Align and merge (HDR+/MotionCam style). Write the merged Bayer frame with `DngCreator.writeByteBuffer` and the reference frame's result [O-DNG].
- Stage 3 (stretch): super-resolution merge for zoomed crops.
- Stream frames into the merge. Do not hold the whole burst.
- Measure RAW min frame duration and stall first (§2b).

---

## 10. RAW / DNG output

### 10a. Formats

| Format          | Bytes/px | CameraX | DngCreator | Source       |
| --------------- | -------- | ------- | ---------- | ------------ |
| `RAW_SENSOR`    | 2        | Yes     | Yes        | [O-IF][X-IC] |
| `RAW10`/`RAW12` | 1.25/1.5 | No      | No         | [O-IF]       |
| `RAW_PRIVATE`   | opaque   | No      | No         | [O-IF]       |

- CameraX lists `OUTPUT_FORMAT_RAW` only with the RAW capability **and** RAW_SENSOR in the output formats [X-IC].
- Release fixes: 1.5.0-beta02 false RAW reporting; 1.6.0-beta02 in-memory `RAW_JPEG` crash. The app's versions include both [O-RN].
- In-memory `RAW_JPEG` calls `onCaptureSuccess` twice, unordered. File-save needs two output options [O-IC].

### 10b. What CameraX's DNG writer leaves out

| Gap                                  | Fact                                                                                       | Source       |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------ |
| No GPS, no thumbnail, no description | CameraX calls only `setOrientation`, then `writeImage`. Pixels are not rotated.            | [X-DNG]      |
| No shading GainMap unless map is on  | DNG OpcodeList2 GainMap is written only if the result holds `STATISTICS_LENS_SHADING_MAP`. | [A-DNGJNI]   |
| CameraX does not enable the map      | Only a test template sets `STATISTICS_LENS_SHADING_MAP_MODE`.                              | [X-CS] (INF) |
| Static white level                   | WhiteLevel uses static `SENSOR_INFO_WHITE_LEVEL`; BlackLevel uses dynamic when present.    | [A-DNGJNI]   |
| Uncompressed                         | Compression tag = 1 (none). ≈2 MB per MP: ≈25 MB at 12.5 MP (INF).                         | [A-DNGJNI]   |

- `STATISTICS_LENS_SHADING_MAP_MODE` ON "is always supported on devices with the RAW capability" [O-CR].
- DngCreator: "strongly recommended that lens shading map output is enabled" [O-DNG].
- The map "may depend on" AE/AWB statistics; wait for convergence [O-CR].
- Embedded if present: NoiseProfile (from `SENSOR_NOISE_PROFILE`), color matrices, AsShotNeutral, WarpRectilinear (from lens distortion), BadPixel (from hot-pixel map) [A-DNGJNI].
- Google Camera DNGs on Pixel 7 Pro ≈12 MB, likely compressed [S-PIXDNG, forum].

**Do (INF):**

- Set `STATISTICS_LENS_SHADING_MAP_MODE_ON` and `STATISTICS_HOT_PIXEL_MAP_MODE = true` via Camera2Interop on ImageCapture.
- Capture after AE/AWB converge.
- For GPS and thumbnail: take in-memory RAW and write with an app `DngCreator` (`setLocation`, `setThumbnail` ≤256 px). Needs the matching `CaptureResult`; public CameraX access is unconfirmed. **DEVICE TEST.**
- Verify with `exiftool -a -G1 -OpcodeList2 file.dng`.
- Budget ~25 MB per DNG; RAW+JPEG doubles writes.

### 10c. RAW vs ISP JPEG for detail

- Documented to skip RAW: distortion correction, rotate-and-crop, zoom coordinates, post-RAW boost [O-CR].
- Raw-domain learned denoising: "14%-38% lower error rates and 9×-18× faster" than prior methods on the Darmstadt Noise Dataset [P-UNP].
- NTIRE 2019 scores raw-RGB and sRGB denoising as separate tracks; raw "would typically represent a denoising module applied within the in-camera image processing pipeline" [P-SIDD].
- No benchmark found showing a later single-DNG denoise beats the ISP JPEG.

**Do (INF):** keep `RAW_JPEG` where supported: JPEG for review and ID, DNG for later processing.

---

## 11. Preview zoom implementations

Goal: sharp zoomed preview, full-FOV DNG.

| Option                                                               | Detail gain over UI scale                                            | Cost / risk                                                                                      | DNG FOV on Pixel 7    | Source              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------- | ------------------- |
| **a. UI transform of PreviewView** (current, 1–5x)                   | None. ≤1080p source; at 5x ≈384×216 source px fill the screen (INF). | Cheapest. Works on SurfaceView (`PERFORMANCE`) above API 24.                                     | Full                  | [O-PB][O-PV][D-VZ]  |
| **b. Bigger Preview stream** (`ResolutionStrategy` > 1080p) + a or d | Yes, up to the stream size                                           | Not guaranteed with RAW MAX on FULL. May drop fps or fail. Power and bandwidth.                  | Full                  | [O-PB][O-CD][O-CI]  |
| **c. High-res ImageAnalysis loupe**                                  | Yes                                                                  | `YUV MAX + RAW MAX` is LEVEL_3-only. CPU copy cost. 4th stream not guaranteed.                   | Full                  | [O-CD]              |
| **d. Preview-only `CameraEffect` crop** (GPU)                        | None alone; resamples preview                                        | GPU work. Past bug: metering coordinates wrong with an effect.                                   | Full                  | [O-CE][O-RN]        |
| **e. Sensor zoom** `CameraControl.setZoomRatio`                      | Yes: crop before downscale to ≤1080p                                 | Crops every processed stream: a `RAW_JPEG` **JPEG is cropped**. 3A regions follow zoom (useful). | Full (no CROPPED_RAW) | [O-CR][O-CI][D-REF] |

Facts behind the table:

- Crop region applies per request to all processed outputs; RAW "not croppable unless supported" [O-CR].
- PreviewView `PERFORMANCE` (SurfaceView) is lower power and latency; `COMPATIBLE` (TextureView) adds GPU blending [O-PV].
- Default `FILL_CENTER` already hides part of the captured FOV [O-PV].
- `CameraEffect` may target `PREVIEW` alone [O-CE].
- `CONTROL_SETTINGS_OVERRIDE_ZOOM` cuts sensor-zoom latency where listed; Camera2Interop only [O-CR].
- Current code: comment on `ViewZoomLimits.maxScale`: "Past this the preview stream is too coarse to show more" [D-VZ].

**Do (INF):**

- RAW-only capture: option e (sensor zoom) gives real preview detail for free. DNG stays full frame on Pixel 7. Show the user the full DNG frame afterwards.
- `RAW_JPEG` with a full-FOV JPEG required: keep option a. Try b only after `isSessionConfigSupported` passes; measure fps.
- Skip c on FULL devices.
- **DEVICE TEST:** DNG dimensions and content at 1x and 5x sensor zoom with RAW-only ImageCapture.
- Conflict: [ui-ux current-state](../agents/ui-ux/current-state/camera-pinch-zoom.md) says the sensor stays at 1x so the saved photo is full field. Option e keeps that for the DNG only. It changes the JPEG. A product decision is needed before adopting e with `RAW_JPEG`.

---

## 12. Logging and measurement

Per-shot result keys (via `Camera2Interop.Extender.setSessionCaptureCallback` on ImageCapture; already used on Preview for profiling [D-CODE]):

| Diagnoses    | Keys                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blur / shake | `SENSOR_EXPOSURE_TIME`, `SENSOR_FRAME_DURATION`, `SENSOR_ROLLING_SHUTTER_SKEW`, `LENS_OPTICAL_STABILIZATION_MODE`, `SENSOR_TIMESTAMP`                                           |
| Focus        | `CONTROL_AF_STATE`, `LENS_STATE`, `LENS_FOCUS_DISTANCE`, `LENS_FOCUS_RANGE`                                                                                                     |
| Noise        | `SENSOR_SENSITIVITY`, `CONTROL_POST_RAW_SENSITIVITY_BOOST`, `SENSOR_NOISE_PROFILE`, `SENSOR_DYNAMIC_BLACK_LEVEL`, applied `NOISE_REDUCTION_MODE`, `EDGE_MODE`                   |
| Exposure     | `CONTROL_AE_MODE`, `CONTROL_AE_STATE`, `CONTROL_AE_TARGET_FPS_RANGE`, `CONTROL_AE_EXPOSURE_COMPENSATION`, `CONTROL_AE_PRIORITY_MODE` (36), `CONTROL_LOW_LIGHT_BOOST_STATE` (35) |
| Geometry     | `CONTROL_ZOOM_RATIO`, `SCALER_CROP_REGION`, `LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID`, `SENSOR_PIXEL_MODE`, `SENSOR_RAW_BINNING_FACTOR_USED`                                    |
| Latency      | `REQUEST_PIPELINE_DEPTH`                                                                                                                                                        |

- `READ_SENSOR_SETTINGS` guarantees exposure, ISO, focus distance and aperture in results even with 3A on [O-CM].
- Report applied modes, not requested ones: FAST NR "may be the same as MINIMAL … or OFF" [O-CRes].
- Shutter lag ≈ pipeline depth × frame interval. Dusk frames lengthen it (INF from [O-CC]).
- Thermal: `PowerManager.getThermalHeadroom` (≤1/s) and thermal status listener [O-PM].
- MPC: `Build.VERSION.MEDIA_PERFORMANCE_CLASS` [O-MPC]. CDD 2.2.7.2 camera requirements [O-CDD]:

  | Req        | Android 12 (MPC 31)                              | Android 13–15                                            |
  | ---------- | ------------------------------------------------ | -------------------------------------------------------- |
  | 7.5/H-1-3  | Back primary FULL or better; front LIMITED+      | Same                                                     |
  | 7.5/H-1-5  | camera2 JPEG capture latency < 1000 ms           | < 1000 ms                                                |
  | 7.5/H-1-6  | camera2 startup (open to first preview) < 600 ms | **< 500 ms**                                             |
  | 7.5/H-1-8  | RAW on back primary                              | Same                                                     |
  | 7.5/H-1-15 | —                                                | Android 15: Night mode extension via CameraX and Camera2 |

- Pixel 7 (`device-panther.mk`) and Pixel 7 Pro (`device-cheetah.mk`) both set `ro.odm.build.media_performance_class=33` on AOSP main [A-MK]. Confirm on device with `getprop`.
- Extend the Macrobenchmark plan [D-MB] with `RAW_JPEG` iterations, two save sections, and thermal headroom at start and end.

---

## 13. Current code vs this guide

| Area             | Current [D-CODE][D-CT]                        | Finding                                                             | §      |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------- | ------ |
| Output format    | No `setOutputFormat`; JPEG only [D-REF §11]   | RAW needs `getSupportedOutputFormats` gate + `setOutputFormat`      | 10     |
| Motion priority  | Pins fps range with highest lower bound       | Caps exposure at dusk; does not force a fast shutter                | 4a–b   |
| Default tuning   | Both priorities true → ZSL                    | ZSL skips precapture; HAL ZSL may return a pre-tap frame            | 8      |
| Resolution       | `PREFER_HIGHER_RESOLUTION` + highest strategy | Output pool/latency tradeoff; max sensor mode is separate           | 2a, 3a |
| Tap / subject AF | Default 0.15 point, `FLAG_AF \| FLAG_AE`      | Too large under UI zoom; scale by 1/zoom                            | 5c     |
| OIS              | Not set                                       | HAL default; set ON explicitly and log                              | 6      |
| Lens shading map | Not set                                       | DNG lacks GainMap unless ON                                         | 10b    |
| Preview zoom     | PreviewView scale 1–5x                        | Sensor zoom is sharper and DNG-safe for RAW-only                    | 11     |
| Low-light boost  | Opt-out prop                                  | AE mode likely absent on Pixel 7; Play-services LLB is preview-only | 4i     |

The selector's output pool does not guarantee a noise or fine-detail benefit;
measure the selected configuration on the target device.

---

## 14. Device test plan

Run on Pixel 7. One dump answers most static questions:

```bash
adb shell dumpsys media.camera > camdump.txt
```

```bash
grep -E "supportedHardwareLevel|availableCapabilities|pixelArraySize|preCorrectionActiveArraySize|activeArraySize|physicalSize|exposureTimeRange|sensitivityRange|maxAnalogSensitivity|maxFrameDuration|aeAvailableTargetFpsRanges|aeAvailablePriorityModes|availableFocalLengths|availableApertures|minimumFocusDistance|hyperfocalDistance|focusDistanceCalibration|availableOpticalStabilization|availableVideoStabilizationModes|maxRegions|timestampSource|zoomRatioRange|availableStreamUseCases|availableSettingsOverrides|availableNoiseReductionModes|availableEdgeModes|availableHotPixelModes|binningFactor|pixelMode" camdump.txt
```

```bash
adb shell getprop ro.odm.build.media_performance_class
```

Dynamic tests:

| #   | Test                                                                                   | Settles |
| --- | -------------------------------------------------------------------------------------- | ------- |
| 1   | `getSupportedOutputFormats()` lists RAW / RAW_JPEG                                     | 10a     |
| 2   | Exposure and ISO at dusk: highest-floor range vs (≤15, max)                            | 4a      |
| 3   | Session fps range present in still requests on 1.7.0-alpha01                           | 4a      |
| 4   | `SENSOR_NOISE_PROFILE` O-term vs ISO; find read-noise floor                            | 4c      |
| 5   | Moving target at 10/15/20 m: blur px vs shutter                                        | 4d      |
| 6   | AF state at dusk; time to lock; far preset sharpness, tilted up and down               | 5       |
| 7   | Default OIS mode in CameraX still results                                              | 6       |
| 8   | DNG diff across NR OFF/FAST/HQ, edge modes, tonemap curves                             | 4f, 7   |
| 9   | JPEG-only vs RAW_JPEG JPEG: HDR+ present or not                                        | 8       |
| 10  | RAW_SENSOR min frame duration + stall; measured burst fps FAST vs HQ                   | 2b, 9b  |
| 11  | `isExtensionAvailable(NIGHT)`; zoom/AF keys; latency                                   | 9a      |
| 12  | CameraX DNG: OpcodeList2 present with and without shading-map interop                  | 10b     |
| 13  | DNG dimensions and content at 1x and 5x sensor zoom, RAW-only and RAW_JPEG             | 11      |
| 14  | `isSessionConfigSupported`: Preview >1080p + RAW; ImageAnalysis 4 MP + RAW; fps        | 2a, 11  |
| 15  | RAW_JPEG capture-to-save latency at bright and dusk vs JPEG baseline 660/284 ms [D-MB] | 12      |
| 16  | Minutes of preview + periodic RAW until thermal MODERATE                               | 12      |

---

## 15. Conflicts and unverified

| Item                     | Conflict                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setLockingMode` version | Release notes: 1.7.0-alpha02. Reference page: "Added in 1.7.0-rc02".                                                                                                                  |
| `EXTENSION_STRENGTH` 100 | Camera2: maximum. CameraX: default.                                                                                                                                                   |
| Night Sight frame count  | Blog: up to 15 handheld. Paper: 6–13. (Per-frame cap resolved: ≤333 ms handheld; 1/15 s is the high-motion end of the range.)                                                         |
| DNG size                 | DngCreator uncompressed ≈25 MB vs GCam ≈12 MB.                                                                                                                                        |
| "RAW bypasses ISP"       | HDR+ paper: yes. Camera2: only some blocks stated; HAL: "minimal processing".                                                                                                         |
| Pixel 7 aperture         | f/1.85 (TechAdvisor) vs f/1.9 (GSMArena). Read `LENS_INFO_AVAILABLE_APERTURES` on device.                                                                                             |
| CameraX source branch    | All [X-…] rows read from `androidx-main`, not the pinned versions.                                                                                                                    |
| Re-verification          | 2026-11-14: snippet-only claims re-read in full. 2026-11-15: S-ISO, S-WL, S-PCS re-sourced; sensor model from leak (S-GN1). Still unverified (†): store.google.com (JS-only page).    |
| Corrections from re-read | MPC startup < 500 ms from Android 13; FULL required on back primary only; S-PX50 says nothing about Pixel 8 Pro; ultrawide "fixed focus" not found; LED "long range" quote not found. |

---

## 16. Sources

Fetched 2026-11-14. developer.android.com pages read in full.

| Key       | Source                                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O-CR      | [CaptureRequest](https://developer.android.com/reference/android/hardware/camera2/CaptureRequest)                                                                                                                                                                                                                                                                                          |
| O-CRes    | [CaptureResult](https://developer.android.com/reference/android/hardware/camera2/CaptureResult)                                                                                                                                                                                                                                                                                            |
| O-CC      | [CameraCharacteristics](https://developer.android.com/reference/android/hardware/camera2/CameraCharacteristics)                                                                                                                                                                                                                                                                            |
| O-CM      | [CameraMetadata](https://developer.android.com/reference/android/hardware/camera2/CameraMetadata)                                                                                                                                                                                                                                                                                          |
| O-CD      | [CameraDevice](https://developer.android.com/reference/android/hardware/camera2/CameraDevice) (`createCaptureSession` stream tables)                                                                                                                                                                                                                                                       |
| O-SCM     | [StreamConfigurationMap](https://developer.android.com/reference/android/hardware/camera2/params/StreamConfigurationMap)                                                                                                                                                                                                                                                                   |
| O-CCS     | [CameraCaptureSession](https://developer.android.com/reference/android/hardware/camera2/CameraCaptureSession)                                                                                                                                                                                                                                                                              |
| O-CEC     | [CameraExtensionCharacteristics](https://developer.android.com/reference/android/hardware/camera2/CameraExtensionCharacteristics)                                                                                                                                                                                                                                                          |
| O-CES     | [CameraExtensionSession](https://developer.android.com/reference/android/hardware/camera2/CameraExtensionSession)                                                                                                                                                                                                                                                                          |
| O-DNG     | [DngCreator](https://developer.android.com/reference/android/hardware/camera2/DngCreator)                                                                                                                                                                                                                                                                                                  |
| O-IF      | [ImageFormat](https://developer.android.com/reference/android/graphics/ImageFormat)                                                                                                                                                                                                                                                                                                        |
| O-SC      | [SessionConfig](https://developer.android.com/reference/kotlin/androidx/camera/core/SessionConfig)                                                                                                                                                                                                                                                                                         |
| O-CI      | [CameraInfo](https://developer.android.com/reference/androidx/camera/core/CameraInfo)                                                                                                                                                                                                                                                                                                      |
| O-IC      | [ImageCapture](https://developer.android.com/reference/androidx/camera/core/ImageCapture), [ImageCaptureCapabilities](https://developer.android.com/reference/kotlin/androidx/camera/core/ImageCaptureCapabilities)                                                                                                                                                                        |
| O-RS      | [ResolutionSelector](https://developer.android.com/reference/androidx/camera/core/resolutionselector/ResolutionSelector)                                                                                                                                                                                                                                                                   |
| O-FMA     | [FocusMeteringAction.Builder](https://developer.android.com/reference/kotlin/androidx/camera/core/FocusMeteringAction.Builder)                                                                                                                                                                                                                                                             |
| O-MPF     | [CameraX configuration guide](https://developer.android.com/media/camera/camerax/configuration)                                                                                                                                                                                                                                                                                            |
| O-PB      | [Preview.Builder](https://developer.android.com/reference/kotlin/androidx/camera/core/Preview.Builder)                                                                                                                                                                                                                                                                                     |
| O-PV      | [CameraX preview guide](https://developer.android.com/media/camera/camerax/preview), [PreviewView.ImplementationMode](https://developer.android.com/reference/kotlin/androidx/camera/view/PreviewView.ImplementationMode), [PreviewView.ScaleType](https://developer.android.com/reference/kotlin/androidx/camera/view/PreviewView.ScaleType)                                              |
| O-CE      | [CameraEffect](https://developer.android.com/reference/kotlin/androidx/camera/core/CameraEffect)                                                                                                                                                                                                                                                                                           |
| O-CX2     | [Camera2CameraControl](https://developer.android.com/reference/kotlin/androidx/camera/camera2/interop/Camera2CameraControl)                                                                                                                                                                                                                                                                |
| O-CXEXT   | [CameraExtensionsControl](https://developer.android.com/reference/kotlin/androidx/camera/extensions/CameraExtensionsControl)                                                                                                                                                                                                                                                               |
| O-RN      | [CameraX release notes](https://developer.android.com/jetpack/androidx/releases/camera)                                                                                                                                                                                                                                                                                                    |
| O-EXT     | [Camera extensions](https://developer.android.com/media/camera/camera-extensions), [CameraX Extensions API](https://developer.android.com/media/camera/camerax/extensions-api)                                                                                                                                                                                                             |
| O-SD      | [Extensions supported devices](https://developer.android.com/media/camera/supported-devices)                                                                                                                                                                                                                                                                                               |
| O-LLB     | [Choose a low-light option](https://developer.android.com/media/camera/lowlight/choose-option), [Low Light Boost blog](https://developer.android.com/blog/posts/brighten-your-real-time-camera-feeds-with-low-light-boost)                                                                                                                                                                 |
| O-LLBGP   | [Google Low Light Boost concepts](https://developer.android.com/media/camera/lowlight/low-light-boost-gp/concepts)                                                                                                                                                                                                                                                                         |
| O-HDRF    | [Ultra HDR image format](https://developer.android.com/media/platform/hdr-image-format)                                                                                                                                                                                                                                                                                                    |
| O-SENS    | [Sensors overview](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview), [Motion sensors](https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion), [SensorEvent](https://developer.android.com/reference/android/hardware/SensorEvent)                                                                                          |
| O-PM      | [PowerManager](https://developer.android.com/reference/android/os/PowerManager)                                                                                                                                                                                                                                                                                                            |
| O-MPC     | [Media performance class](https://developer.android.com/topic/performance/performance-class)                                                                                                                                                                                                                                                                                               |
| O-CDD     | Android CDD 2.2.7.2: [12](https://source.android.com/docs/compatibility/12/android-12-cdd), [13](https://source.android.com/docs/compatibility/13/android-13-cdd), [14](https://source.android.com/docs/compatibility/14/android-14-cdd), [15](https://source.android.com/docs/compatibility/15/android-15-cdd)                                                                            |
| X-CP      | [CapturePipeline.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/main/java/androidx/camera/camera2/impl/CapturePipeline.kt)                                                                                                                                                                                                                          |
| X-CS      | GitHub code search over `androidx/androidx` `camera/` (default branch; can miss matches), incl. [CameraGraphConfigProvider.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/main/java/androidx/camera/camera2/impl/CameraGraphConfigProvider.kt)                                                                                                      |
| X-SCRT    | [StillCaptureRequestControlTest.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/test/java/androidx/camera/camera2/impl/StillCaptureRequestControlTest.kt), [UseCaseCameraRequestControl.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/main/java/androidx/camera/camera2/impl/UseCaseCameraRequestControl.kt) |
| X-CCA     | [CaptureConfigAdapter.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/main/java/androidx/camera/camera2/adapter/CaptureConfigAdapter.kt)                                                                                                                                                                                                             |
| X-IPL     | [ImagePipeline.java](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-core/src/main/java/androidx/camera/core/imagecapture/ImagePipeline.java)                                                                                                                                                                                                                        |
| X-IC      | [ImageCapture.java](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-core/src/main/java/androidx/camera/core/ImageCapture.java)                                                                                                                                                                                                                                       |
| X-DNG     | [DngImage2Disk.java](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-core/src/main/java/androidx/camera/core/imagecapture/DngImage2Disk.java)                                                                                                                                                                                                                        |
| X-FMC     | [FocusMeteringControl.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/main/java/androidx/camera/camera2/impl/FocusMeteringControl.kt), [State3AControl.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/main/java/androidx/camera/camera2/impl/State3AControl.kt)                                               |
| X-MPF     | [MeteringPointFactory.java](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-core/src/main/java/androidx/camera/core/MeteringPointFactory.java)                                                                                                                                                                                                                       |
| X-Q       | [PreviewPixelHDRnetQuirk.kt](https://github.com/androidx/androidx/blob/androidx-main/camera/camera-camera2/src/main/java/androidx/camera/camera2/compat/quirk/PreviewPixelHDRnetQuirk.kt), `ImageCapturePixelHDRPlusQuirk.kt` (same folder)                                                                                                                                                |
| A-DNGJNI  | [android_hardware_camera2_DngCreator.cpp](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/core/jni/android_hardware_camera2_DngCreator.cpp)                                                                                                                                                                                                                    |
| A-HAL     | [camera3.h](https://raw.githubusercontent.com/aosp-mirror/platform_hardware_libhardware/android14-release/include/hardware/camera3.h) (android14-release)                                                                                                                                                                                                                                  |
| A-HAL-GFX | [graphics/common/1.0/types.hal](https://android.googlesource.com/platform/hardware/interfaces/+/refs/heads/main/graphics/common/1.0/types.hal) (RAW16 comment; formerly in system/core graphics.h)                                                                                                                                                                                         |
| A-MK      | [device-panther.mk](https://android.googlesource.com/device/google/pantah/+/refs/heads/main/device-panther.mk), [device-cheetah.mk](https://android.googlesource.com/device/google/pantah/+/refs/heads/main/device-cheetah.mk)                                                                                                                                                             |
| P-HDRP    | Hasinoff et al. 2016, [Burst photography for HDR and low-light imaging](https://people.csail.mit.edu/hasinoff/pubs/HasinoffEtAl16-hdrplus.pdf)                                                                                                                                                                                                                                             |
| P-HDRD    | [HDR+ dataset](https://hdrplusdata.org/dataset.html)                                                                                                                                                                                                                                                                                                                                       |
| P-NS      | Liba et al. 2019, [Handheld Mobile Photography in Very Low Light](https://arxiv.org/pdf/1910.11336)                                                                                                                                                                                                                                                                                        |
| P-NSB     | [Night Sight blog](https://research.google/blog/night-sight-seeing-in-the-dark-on-pixel-phones/)                                                                                                                                                                                                                                                                                           |
| P-SR      | Wronski et al. 2019, [Handheld multi-frame super-resolution](https://arxiv.org/abs/1905.03277)                                                                                                                                                                                                                                                                                             |
| P-BIN     | Singh & Singh, [Double Binnable RGB, RGBW and LMS Color Filter Arrays](https://arxiv.org/html/2306.17078v2)                                                                                                                                                                                                                                                                                |
| P-UNP     | Brooks et al. 2019, [Unprocessing Images for Learned Raw Denoising](https://arxiv.org/pdf/1811.11127)                                                                                                                                                                                                                                                                                      |
| P-SIDD    | [NTIRE 2019 real image denoising](https://openaccess.thecvf.com/content_CVPRW_2019/papers/NTIRE/Abdelhamed_NTIRE_2019_Challenge_on_Real_Image_Denoising_Methods_and_Results_CVPRW_2019_paper.pdf)                                                                                                                                                                                          |
| S-PX7     | [9to5Google Pixel 7 cameras](https://9to5google.com/2022/10/12/every-camera-on-pixel-7-pro/), [GSMArena Pixel 7](https://www.gsmarena.com/google_pixel_7-11903.php), [TechAdvisor](https://www.techadvisor.com/article/745544/google-pixel-7.html)                                                                                                                                         |
| S-PX50    | [Android Authority, Pixel camera tweaks](https://www.androidauthority.com/google-pixel-camera-app-tweaks-3357628)                                                                                                                                                                                                                                                                          |
| S-GOS     | [GrapheneOS forum, Pixel 8 Pro 50 MP](https://discuss.grapheneos.org/d/11321-pixel-8-pro-camera-activating-50mp-mode)                                                                                                                                                                                                                                                                      |
| S-SAM     | [Samsung semiconductor blog, 200 MP](https://semiconductor.samsung.com/news-events/tech-blog/what-defines-a-true-200-megapixel-experience/)                                                                                                                                                                                                                                                |
| S-ISO     | [Capture the Atlas, ISO invariance](https://capturetheatlas.com/iso-invariance)                                                                                                                                                                                                                                                                                                            |
| S-WL      | [Castle Cameras, animals in motion](https://www.castlecameras.co.uk/article/526-photographing-animals-in-motion)                                                                                                                                                                                                                                                                           |
| S-GN1     | [GSMArena, Pixel 7 sensors uncovered (2022-07-27)](https://www.gsmarena.com/google_pixel_7_7_pro_pixel_tablet_and_foldable_smartphone_camera_sensors_uncovered-news-55200.php), [9to5Google (2022-07-26)](https://9to5google.com/2022/07/26/pixel-7-pro-tablet-camera-sensors/)                                                                                                            |
| S-LED     | [UniquePhoto Q&A (Photography Stack Exchange repost), LED guide number](https://www.uniquephoto.com/community/qa/can-a-smartphone-led-flash-be-described-with-a-guide-number)                                                                                                                                                                                                              |
| S-DXO     | [DXOMARK, large sensors](https://www.dxomark.com/dxomark-decodes-how-a-large-sensor-in-a-smartphone-affects-image-quality/)                                                                                                                                                                                                                                                                |
| S-IMA     | [Imatest sharpening](https://www.imatest.com/docs/sharpening)                                                                                                                                                                                                                                                                                                                              |
| S-GP      | [google/pixelvisualcorecamera README](https://github.com/google/pixelvisualcorecamera) ("not an officially supported Google product")                                                                                                                                                                                                                                                      |
| S-PCS     | [CameraX developers group, Pixel night extensions](https://groups.google.com/a/android.com/g/camerax-developers/c/jgEygQ3EXdk) (mailing list)                                                                                                                                                                                                                                              |
| S-MC      | [MotionCam README](https://raw.githubusercontent.com/f0enix/motioncam/master/README.md)                                                                                                                                                                                                                                                                                                    |
| S-SRIMPL  | [ImageStackAlignator README](https://raw.githubusercontent.com/kunzmi/ImageStackAlignator/master/README.md), [Handheld-Multi-Frame-Super-Resolution README](https://raw.githubusercontent.com/Jamy-L/Handheld-Multi-Frame-Super-Resolution/main/README.md)                                                                                                                                 |
| S-PIXDNG  | [pixls.us, Pixel 7 Pro RAW](https://discuss.pixls.us/t/pixel-7-pro-raw-processing/33942) (forum)                                                                                                                                                                                                                                                                                           |
| D-REF     | [2026-11-14-android-camera-capture-parameters.md](2026-11-14-android-camera-capture-parameters.md)                                                                                                                                                                                                                                                                                         |
| D-CODE    | `modules/native-identification-camera/android/src/main/java/expo/modules/nativeidentificationcamera/NativeIdentificationCameraView.kt` (`buildImageCapture`, `buildSessionConfig`, `bindCamera`, `focusPreviewPoint`)                                                                                                                                                                      |
| D-CT      | `modules/native-identification-camera/android/src/main/java/expo/modules/nativeidentificationcamera/CaptureTuning.kt`                                                                                                                                                                                                                                                                      |
| D-VZ      | `modules/native-identification-camera/android/src/main/java/expo/modules/nativeidentificationcamera/ViewZoom.kt`                                                                                                                                                                                                                                                                           |
| D-MB      | [2026-10-23-macrobenchmark-camera-profiling.md](../planning/2026-10-23-macrobenchmark-camera-profiling.md)                                                                                                                                                                                                                                                                                 |
