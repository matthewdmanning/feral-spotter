---
status: accepted
---

# Time capture model: device-trusted by default, EXIF-absence triggers manual fallback

A Submission carries exactly **one Submission time** shared by all its photos — the time equivalent of Submission location (ADR 0002). For camera captures, `time_type` defaults to `'device'` with no explicit timestamp stored: `submitted_at` (set at API-call time, `src/utils/api.ts:247`) *is* the sighting time, because a camera photo is definitionally submitted moments after capture.

The **Library pick** entrypoint (sprint:camera, #104) breaks that equivalence — a picked photo could be days old, so "moment of submission" is no longer a safe stand-in for "moment of sighting." A Library pick reads the asset's EXIF `DateTime`:

- **Present** → `time_type` stays `'device'` (trusted, not user-editable) **and** the extracted timestamp is stored explicitly as `submission.captured_at` (new optional ISO field, `useSubmissionStore`/`SubmissionApiPayload`) — the time equivalent of the Map picker producing an explicit coordinate for an untrusted-GPS location. Without this field the backend would fall back to `submitted_at`, silently recording "now" for a photo that isn't from now — the bug this ADR exists to avoid.
- **Absent** → `time_type` flips to `'manual'`; the existing validation gate (`src/utils/validation.ts`) already requires `manual_time` before submission, filled via the existing `DateTimePickerButton` modal (`src/components/organisms/DateTimePicker.tsx`) — same warning icon and "tap to fix" affordance Submission Details already uses for low GPS accuracy, applied to time instead of location.

**Multi-select** (library picker allows selecting several photos at once): if every selected photo has EXIF `DateTime`, the earliest one becomes `captured_at`. If any selected photo lacks EXIF time, the whole submission falls back to `'manual'` — one `manual_time` entry covers the batch. This is an **interim MVP rule**, superseded by a Beta-milestone follow-up that sends each photo's own EXIF location/time to the backend for real per-photo clustering (see the linked Beta issue) — a genuine data-model change (breaks the "one value per Submission" premise below) explicitly out of scope here.

## Considered Options

- **Always trust EXIF when present, never ask** — accepted; matches ADR 0002's source-based-trust principle (device data over user input, same as GPS's Live fix).
- **Always require manual entry for Library picks, regardless of EXIF** — rejected: needless friction when EXIF is already correct, and inconsistent with how location seeds from EXIF and lets the user confirm rather than always forcing manual entry.
- **Leave EXIF-present classified `'device'` with no stored value** — rejected (caught in review before this ADR was finalized): collapses to "record `submitted_at` as the sighting time," which is wrong for any photo not taken moments before submit. `captured_at` exists specifically to avoid this.
- **Send per-photo EXIF time/location to the backend now** — rejected for MVP: real feature (distance threshold, per-photo transmission, backend clustering), not a UI addition; deferred to Beta as its own effort.

## Consequences

- `submission.captured_at` is new: optional, set only by a Library pick with EXIF time. Camera captures and manual-fallback submissions never set it.
- **Backend consumption is unverified, not "read order" logic** — checked `src/app/*+api.ts`: no field named `time_type`/`manual_time`/`captured_at` is read anywhere server-side today. The MVP backend is validation-only (file type/size/MIME + auth, per the roadmap), so this is pure JSON passthrough — same as `submission.location_type` under ADR 0002. `captured_at` exists so the *value* is preserved in the payload; whatever consumes sighting-time downstream (a later research pipeline, out of this app's scope) is where the actual "which field wins" logic would live, not in this app.
- Same asymmetry as ADR 0002's Live fix: a Library pick's EXIF-derived `'device'` classification is not user-editable, only the `'manual'` fallback is.
- The MVP multi-select rule (earliest-EXIF-wins / any-missing-forces-manual) is explicitly interim and will be superseded, not extended, by the Beta per-photo clustering work.
