# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

All shared vocabulary lives in this file. No other files contain the vocabulary list.

## Before exploring, read these

- **This file's Language section, below.**
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If `docs/adr/` doesn't exist, **proceed silently**. Don't flag its absence; don't suggest creating it upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates it lazily when terms or decisions actually get resolved.

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

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the Language section below. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## Language

FeralSpotter: a mobile app for reporting feral-cat sightings — users spot a cat, capture photos and details, and submit them to a research database used by rescue volunteers and ecology researchers.

### Sighting & location

**Submission**:
One reported feral-cat sighting — the data-model unit the user builds and sends. Holds one or more photos and exactly one location. Use **Sighting** for the user-facing name of this same unit, as chosen for issue #371 on 2026-09-25; keep **Submission** for code, persistence, API, and engineering discussion.
_Avoid_: report, observation, entry

**Submission location**:
The single geographic point a Submission is tagged with, shared by every photo in it. An app-level value the user sees and (in some paths) sets; it is not the same thing as a photo's embedded EXIF. One Submission has one Submission location — separate places require separate Submissions.
_Avoid_: metadata, geotag, coordinates (when referring to the app-level value)

**Live fix**:
The device GPS reading used for a Submission's location. Acquired by a background task that starts when the camera opens, keeps watching until accuracy is good enough, and silently reacquires if too much time passes without a good result (docs/adr/0002-location-services-model.md, 2026-07-31 amendment). Trusted as authoritative for camera-captured photos and therefore not user-editable.
_Avoid_: GPS location, current location, geolocation (as a noun for the value)

**Map picker**:
The manual location-selection surface: a native, draggable map with a fixed center pin. The Submission location is whatever point sits under the pin when the user confirms. Used for uploaded photos and as the fallback when a Live fix is unavailable.
_Avoid_: map view, location selector, place picker

**Photo EXIF**:
The metadata tags physically embedded in an image file (including any GPS the source camera wrote). Read-only to this app — a possible _seed_ for the Map picker, never the Submission location itself, and never rewritten by us.
_Avoid_: photo metadata (as a synonym for Submission location)

### Sighting & time

**Submission time**:
The single date/time a Submission is tagged with, shared by every photo in it — the time equivalent of Submission location. Defaults to `'device'` (the moment of submission is trusted, no capture-time timestamp is recorded) and falls back to Manual time when that trust doesn't hold (a Library pick with no EXIF timestamp).
_Avoid_: timestamp, date taken (when referring to the app-level value)

**Manual time**:
The user-entered fallback date/time, set via the existing date-time-picker modal, used when Submission time can't be trusted automatically. Corresponds to `time_type === 'manual'` and `submission.manual_time`.
_Avoid_: custom time, override

**Library pick**:
A photo added to the Submission's shared photo pool via the device's photo library rather than the live Camera. Uses the same `SubmissionPhoto` shape and the same pool as camera-captured photos. A draft is **single-source by construction** (ADR 0002 amendment, 2026-07-31): `usePhotoStore`'s `source: 'camera' | 'library' | null` pins to whichever entrypoint wrote the first photo, and the Home screen disables the other entrypoint until the pool is cleared — mixing camera and Library picks in one Submission cannot occur. A Library pick's only other special handling is triggering Manual time when its EXIF has no timestamp.
_Avoid_: uploaded photo, imported photo

### First-run and gating

**Onboarding**:
The first-run flow that explains the app's purpose and why each permission will be needed. It informs only — it does not grant permissions or record acceptance. Realized in code as the `intro-flow` route/folder.
_Avoid_: tutorial, walkthrough.

**Tutorial**:
In-feature guidance that shows the user how to operate a _complex_ part of the app. In FeralSpotter the tutorial teaches the Box Annotation operation. Distinct from Onboarding. Implemented, version-gated (see `src/config/tutorial.ts`'s `isTutorialReleased()`). Status is stored per device in `useTutorialStore` as `annotation_tutorial_status`: `unseen` opens the tutorial on the first Box Annotation entry; `skipped` and `completed` keep it closed. No replay path exists yet (matthewdmanning/feral-spotter#386).
_Avoid_: using this word for anything in the Onboarding flow.

**Box Annotation** ("Box the Cat"):
Drawing a bounding box around each cat in a photo. The app's one genuinely complex operation — the reason a Tutorial is warranted. User-facing term: "Box the Cat." Implemented (`src/screens/submission/annotate/`).

**Camera screen**:
The live photo-capture screen (`src/screens/camera/`). Distinct from Box Annotation (`src/screens/submission/annotate/`) — a common colloquial mix-up since both deal with a just-taken photo.

**Camera seam**:
The boundary between the React Native layer and the Expo native camera views in `modules/native-identification-camera/`. The native side owns the camera session, focus and metering, zoom and capture. The React Native side owns the screen, permissions, settings, captured-photo state, upload and save, and analytics — including anything the native side reports, so there is one analytics-consent gate and one distinct id rather than a second native set of both. `modules/native-identification-camera/src/types.ts` is the contract, and both platforms implement it.
_Avoid_: bridge (this is the Expo Modules API, not the legacy React Native bridge), native camera module (there are two modules under `modules/`).

**Capture backend**:
Which implementation is serving the Camera screen. `visioncamera` is the default and the fallback; `native` is the Camera seam, chosen by the `native_camera_capture` setting. A backend change needs an explicit product decision plus evidence that supported devices and release builds include it — it is not a refactoring side effect.
_Avoid_: capture pipeline, camera variant (both exist as telemetry field names today and mean narrower things; see the note below).

**Capture tuning**:
The named mapping from the `camera_max_detail` and `camera_motion_priority` settings onto one platform capture mode. One table per platform — `CaptureTuning.kt` and `CaptureTuning.swift` — deliberately not one shared policy: the two platforms disagree about what `(true, true)` should mean, and that disagreement is an open product decision, not a defect. The resolved name travels in telemetry as `capture_tuning`, so a profiling run can tell which mode actually ran rather than inferring it from the settings that asked for it.
_Avoid_: quality preset, capture profile.

> **This vocabulary is under review — do not extend it yet.** The camera
> telemetry field names and the camera settings booleans are known to be
> inconsistent: `capture_pipeline` versus `capture_backend` for one concept,
> `camera_variant` carrying real values on one path and the constant `native` on
> the other, `camera_backend` mixing a JavaScript library name with native
> framework names, mixed default polarity across eight booleans, and
> `camera_disable_low_light_boost` naming the negative where the legacy path's
> `enableLowLightBoost` names the positive. The sweep is an open decision because
> renaming settings keys needs a migration decision for values already persisted
> on devices, and renaming telemetry fields has to be one commit or queries break
> mid-series. Until that is decided, use the names the code uses and do not coin
> replacements.

**Consent**:
The user's explicit acceptance of the data-collection disclosure, and the granting of OS permissions (location, camera, photos). This is where acceptance is recorded and permissions are requested — unlike Onboarding, which only explains. Eager priming happens on "I Agree"; contextual re-priming happens at point of use (issue #41).
_Avoid_: onboarding (Consent is the gate, not the explanation).

### Sign-in and authentication

**Federated Sign-In**:
The user proves who they are through an identity provider's _own_ external portal (its account picker or a browser it controls) and the app receives an identity token back. The app never sees or collects the provider password. Every sign-in option FeralSpotter offers — Google, Apple, Facebook — is Federated Sign-In.
Equivalent terms: social login, third-party login.

**Registration**:
A user's initial authenticated entry into the app through Firebase Authentication, via any provider (Google, Apple, Facebook, or email/password). Distinct from a returning sign-in, which authenticates an already-registered user.
_Avoid_: sign-up (prefer Registration), onboarding (that is the first-run explainer, not authentication).

### Cat observation

**Observed Cat / Edit Cat**:
Two labels for the same screen and code path (`src/screens/submission/cats/index.tsx`), not two screens. The title toggles on whether `existingCat` resolves — i.e. whether the `local_id` being opened is already saved in the Submission's cat list. "Observed Cat": no existing record, `addCat` on save. "Edit Cat": record already exists, `updateCat` on save. Same `useCatForm`, `useCatSubmit`, `CatForm`.
_Avoid_: treating these as separate screens/flows when reasoning about the code — there is one implementation, branched on `existingCat`.

**Unknown / Unsure**:
The value recorded for a cat attribute (age, sex, ear tipped, owned/domesticated, pattern, hair length, color, health) that the observer cannot determine — a real, first-class value, not the absence of one. It is the default for every attribute. "Unknown" and "Unsure" name the same concept, surfaced under two labels depending on the attribute. This describes the persisted value — what's saved on `ObservedCat` and sent to the backend, converted from the app's frontend form state at save time.
_Avoid_: unanswered, not-yet-selected, undefined, Touched — there is no separate "left blank" versus "confirmed unknown" _at the persisted layer_; leaving an attribute at its default and explicitly choosing Unknown/Unsure are the same thing.
The frontend form state that produces this value is a separate, transient layer: it starts every attribute unset (`undefined`) and only 4 of the 8 (sex, ear tipped, owned/domesticated, pattern) offer an explicit Unknown/Unsure button — so only those 4 can distinguish "left blank" from "deliberately confirmed Unknown" before save, for the missing-field warning. The other 4 (age, hair length, color, health) have no such button, so their frontend state collapses to this entry's persisted meaning by construction. Those same frontend values also drive what's shown selected when reopening an already-saved cat's form.
