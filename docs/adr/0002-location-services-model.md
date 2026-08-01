---
status: accepted
---

# Location services: one Submission location, source-based trust, native map picker

A Submission carries exactly **one Submission location** shared by all its photos (an info affordance tells the user to split places into separate Submissions). How that location is set depends on the photo's source, and the source determines whether the user may edit it:

- **Camera capture with a good GPS fix** — a single **Live fix** is taken once per Submission and reused; it is authoritative and **not** user-editable, because a live device reading is trustworthy ground truth for a here-and-now capture.
- **Camera capture where GPS is denied/timed out** — fall back to the **Map picker**.
- **Uploaded (library) photo** — the device's current position is meaningless, so the user sets the location via the **Map picker**, seeded from the photo's EXIF when present.

The Submission location is stored as an **app-level value on the photo object and transmitted as JSON** — we do **not** rewrite GPS tags into image bytes.

The Map picker is built on **`expo-maps`** (`GoogleMaps`/`AppleMaps` native views), rendering a device-native map with a fixed center pin as a React Native overlay; the confirmed center coordinate becomes the Submission location. Seed order for the initial camera position: photo EXIF → last-known device position → a default region.

## Considered Options

- **`react-native-geolocation-services`** for the fix — rejected: `expo-location` (already installed) covers the single-fix need in this managed-Expo app with no extra native config.
- **`react-native-maps`** for the map — rejected in favour of first-party `expo-maps`, which matches the all-Expo stack and needs only a config plugin. Accepted trade-off: `expo-maps` is **alpha** in SDK 56; acceptable for the Android-only MVP.
- **Per-photo location** — rejected: a Submission is one sighting at one place, so one location per Submission is the honest model.
- **Embedding GPS into the JPEG's real EXIF** — rejected: adds an EXIF-writing dependency and risks mutating the user's original file, for zero pipeline benefit since the backend consumes the JSON value.
- **Allowing manual override of a good camera Live fix** — rejected: undermines the reason live GPS is trusted in the first place.

## Consequences

- The Android build needs a **Google Maps API key** for the map to render (native map _display_ is free; only Places/autocomplete is billed).
- **Deferred, not part of this work:** address entry / autocomplete (pending a nonprofit partnership for cost), EXIF-vs-selected agreement validation for uploaded photos, and any actual-byte EXIF embedding.
- The `SubmissionPhoto.exif` field name is a misnomer for an app-level value — flagged; rename is out of scope here.

## Amendment (2026-07-31): trigger timing and staleness

Live-fix acquisition was originally triggered from Submission Details, racing a
4-second timeout. User test-drive feedback (#128) moved the trigger earlier
and removed the give-up:

- **Trigger point**: the Live fix now starts in the background the moment the
  camera opens (`useCameraCapture.tsx`'s mount effect) — not on Submission
  Details — so slow GPS resolution has the whole capture session to resolve
  instead of racing a fixed timeout at the end.
- **No restart while in flight**: the acquisition is a module-level singleton
  (`src/lib/location.ts`), not tied to any screen's mount/unmount. It cannot
  be restarted while actively watching.
- **One threshold, two jobs**: it watches (`Location.watchPositionAsync`)
  until accuracy crosses `LOCATION_ACCURACY_THRESHOLD_M` (50m) — that's both
  "good enough to stop watching" and the bar Submission Details' status icon
  checks. Still not user-editable once acquired — this only changes when the
  fetch happens, not the source-based trust model above.
- **Staleness reacquire**: if 5 minutes (`LOCATION_STALE_THRESHOLD_MS`) pass
  without crossing the accuracy bar, the singleton settles for its
  best-so-far fix and automatically retries — this repeats for as long as the
  submission stays open, without needing another caller to notice and
  re-trigger it. A location the user set manually via the Map picker
  (`location_type === 'pin'`) is never overwritten by a later reacquire.

## Amendment (2026-07-31): a draft is single-source by construction

Sprint:camera (#104) adds a second photo entrypoint (Library pick) into the
same shared `usePhotoStore` pool the camera flow already writes to. A mixed
camera+library pool in one draft was considered and **rejected** — a
Submission has exactly **one** location (ADR body above), and a single value
cannot correctly represent "these photos are here-and-now, those are from
wherever the library photo was actually taken." Any arrival-order tiebreaker
(camera-first-wins, library-first-wins) silently mislocates whichever source
arrives second — not a UI quirk, a wrong lat/long transmitted for that photo.

**Resolution: a draft only ever has one source.** Once `usePhotoStore` holds
any photo, the Home screen entrypoint for the *other* source is disabled
until the draft is submitted or reset (clearing the pool). `location_type`
for a Library-sourced draft is simply `'pin'` (forced at the first pick,
pool guaranteed empty by the guard above) — no arrival-order logic needed,
because the mixed case this sprint's earlier drafts of this amendment tried
to patch around cannot occur. True per-photo location for a genuinely mixed
or multi-place batch is #133 (Beta), unchanged.
