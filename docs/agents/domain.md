# Domain Docs

How engineering skills use this repo's domain docs. All shared vocabulary lives here and nowhere else.

## Before exploring, read

- **The Language section below.**
- **`docs/adr/`** — ADRs touching your work area. Multi-context repos: also `src/<context>/docs/adr/`.

No `docs/adr/`? **Proceed silently** — don't flag it or suggest creating it. `/domain-modeling` (via `/grill-with-docs`, `/improve-codebase-architecture`) creates it when terms or decisions get resolved.

## File structure

Single-context repo (most repos):

```text
/
├── docs/agents/domain.md   # this file — vocabulary lives here
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept (issue title, refactor proposal, hypothesis, test name), use the Language term. Don't drift to its _Avoid_ synonyms.

Concept missing from the glossary? Either you're inventing language (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

Surface contradictions with an ADR explicitly; never silently override:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## Language

FeralSpotter: mobile app for reporting feral-cat sightings. Users photograph a cat, add details, and submit to a research database used by rescue volunteers and ecology researchers.

### Sighting & location

**Submission**:
One reported feral-cat sighting — the unit the user builds and sends. One or more photos, exactly one location. User-facing name: **Sighting** (issue #371, 2026-09-25). Use **Submission** in code, persistence, API, and engineering discussion.
_Avoid_: report, observation, entry

**Submission location**:
The single geographic point for a Submission, shared by all its photos. App-level value the user sees and sometimes sets; not the photo's EXIF. Separate places need separate Submissions.
_Avoid_: metadata, geotag, coordinates (for the app-level value)

**Live fix**:
Device GPS reading used for the Submission location. A background task starts when the camera opens, watches until accuracy is good enough, and silently reacquires if a good result goes stale (docs/adr/0002-location-services-model.md, 2026-07-31 amendment). Authoritative for camera photos, so not user-editable.
_Avoid_: GPS location, current location, geolocation (as a noun for the value)

**Map picker**:
Manual location selection: native draggable map with a fixed center pin. The Submission location is the point under the pin on confirm. Used for uploaded photos and as fallback when no Live fix exists.
_Avoid_: map view, location selector, place picker

**Photo EXIF**:
Metadata embedded in the image file (including any camera-written GPS). Read-only — may _seed_ the Map picker, never is the Submission location, never rewritten.
_Avoid_: photo metadata (as a synonym for Submission location)

### Sighting & time

**Submission time**:
The single date/time for a Submission, shared by all its photos — time counterpart of Submission location. Default `'device'` (submission moment trusted, no capture timestamp recorded). Falls back to Manual time when that trust fails (Library pick without EXIF timestamp).
_Avoid_: timestamp, date taken (for the app-level value)

**Manual time**:
User-entered fallback date/time via the existing date-time-picker modal, used when Submission time can't be trusted. `time_type === 'manual'`, `submission.manual_time`.
_Avoid_: custom time, override

**Library pick**:
A photo added from the device photo library instead of the live Camera. Same `SubmissionPhoto` shape and shared pool as camera photos. Drafts are **single-source by construction** (ADR 0002 amendment, 2026-07-31): `usePhotoStore`'s `source: 'camera' | 'library' | null` pins to the first photo's entrypoint; Home disables the other entrypoint until the pool clears, so mixed Submissions can't occur. Only other special case: no EXIF timestamp triggers Manual time.
_Avoid_: uploaded photo, imported photo

### First-run and gating

**Onboarding**:
First-run flow explaining the app's purpose and why each permission is needed. Informs only — grants no permissions, records no acceptance. Code: `intro-flow` route/folder.
_Avoid_: tutorial, walkthrough.

**Tutorial**:
In-feature guidance for a _complex_ operation — here, Box Annotation. Distinct from Onboarding. Implemented, version-gated (`isTutorialReleased()` in `src/features/annotate/config/tutorial.ts`). Per-device status in `useTutorialStore` as `annotation_tutorial_status`: `unseen` opens it on first Box Annotation entry; `skipped`/`completed` keep it closed. No replay path yet (matthewdmanning/feral-spotter#386).
_Avoid_: this word for anything in Onboarding.

**Box Annotation**:
Drawing a bounding box around each cat in a photo. The app's one complex operation — why a Tutorial exists. Implemented (`src/features/annotate/screens/annotate/`).

**Camera screen**:
Live photo-capture screen (`src/features/camera-control/screens/camera/`). Distinct from Box Annotation (`src/features/annotate/screens/annotate/`) — often confused since both handle a just-taken photo.

**Capture backend**:
The implementation serving the Camera screen. `visioncamera` is default and fallback; `native` is the Camera seam, chosen by the `native_camera_capture` setting. Changing backend needs an explicit product decision plus evidence that supported devices and release builds include it — never a refactoring side effect.
_Avoid_: capture pipeline, camera variant (existing telemetry fields with narrower meanings; see note below).

**Capture tuning**:
Named mapping from `camera_max_detail` + `camera_motion_priority` to one platform capture mode. One table per platform (`CaptureTuning.kt`, `CaptureTuning.swift`), deliberately not shared: the platforms disagree on `(true, true)`, an open product decision, not a defect. Resolved name is sent as telemetry `capture_tuning`, so profiling shows the mode that ran, not the settings that requested it.
_Avoid_: quality preset, capture profile.

> **Vocabulary under review — do not extend.** Camera telemetry fields and
> settings booleans are inconsistent: `capture_pipeline` vs `capture_backend`
> for one concept; `camera_variant` real on one path, constant `native` on the
> other; `camera_backend` mixing a JS library name with native framework names;
> mixed default polarity across eight booleans; `camera_disable_low_light_boost`
> negative where legacy `enableLowLightBoost` is positive. The cleanup is open:
> renaming settings keys needs a migration decision for persisted values, and
> telemetry renames must land in one commit or queries break mid-series. Until
> decided, use the code's names; coin no replacements.

**Consent**:
Explicit acceptance of the data-collection disclosure, plus granting OS permissions (location, camera, photos). Records acceptance and requests permissions — Onboarding only explains. Eager priming on "I Agree"; contextual re-priming at point of use (issue #41).
_Avoid_: onboarding (Consent is the gate, not the explanation).

### Sign-in and authentication

**Federated Sign-In**:
User authenticates in an identity provider's _own_ external portal (its account picker or a browser it controls); the app receives an identity token and never sees the provider password. All FeralSpotter sign-in options — Google, Apple, Facebook — are Federated Sign-In.
Equivalent terms: social login, third-party login.

**Registration**:
A user's first authenticated entry via Firebase Authentication, any provider (Google, Apple, Facebook, email/password). Distinct from returning sign-in of an already-registered user.
_Avoid_: sign-up (prefer Registration), onboarding (first-run explainer, not authentication).

### Cat observation

**Observed Cat / Edit Cat**:
Two titles for one screen and code path (`src/features/draft-submission/screens/cats/index.tsx`). Title depends on whether `existingCat` resolves (the opened `local_id` is already in the Submission's cat list). "Observed Cat": no record, `addCat` on save. "Edit Cat": record exists, `updateCat` on save. Shared `useCatForm`, `useCatSubmit`, `CatForm`.
_Avoid_: treating these as separate screens/flows — one implementation, branched on `existingCat`.

**Unknown / Unsure**:
Persisted value for a cat attribute (age, sex, ear tipped, owned/domesticated, pattern, hair length, color, health) the observer can't determine — a first-class value, not an absence, and every attribute's default. Same concept, two labels by attribute. Saved on `ObservedCat` and sent to the backend, converted from frontend form state at save.
_Avoid_: unanswered, not-yet-selected, undefined, Touched — _at the persisted layer_, leaving the default and choosing Unknown/Unsure are identical.
Frontend form state is a separate, transient layer: every attribute starts `undefined`. Only 3 of 8 (sex, ear tipped, owned/domesticated) have an explicit Unknown/Unsure button, so only they distinguish "left blank" from "confirmed Unknown" before save (for the missing-field warning). The other 5 (age, hair length, pattern, color, health) have no button, so their frontend state collapses to the persisted meaning. These frontend values also set the selected state when reopening a saved cat.
