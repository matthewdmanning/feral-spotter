# #224 — Library Pick Manual-time fallback

[GitHub issue #224](https://github.com/matthewdmanning/feral-spotter/issues/224) · label `chore` · milestone Alpha · common context: [README](README.md)

## What's already verified (don't re-test)

Device-tested on Pixel 7, 2026-08-09, for [#76](not-ready/76-photo-timestamps-closure.md):
timestamps thread correctly for both the Camera path (EXIF `DateTimeOriginal`
present and correct) and the Library Pick path _when the picked photo has
EXIF_ — submission cache correctly recorded `metadata.captured_at` matching
the photo's real date, `metadata.time_method: "device"`.

## What's not verified — this ticket's scope

Per [domain.md](../../agents/domain.md)'s "Library pick" definition, a
picked photo with **no** EXIF timestamp should trigger Manual time instead.
This path was never exercised — no EXIF-less photo was available on the
test device.

## To test this

1. Get a fixture photo with no EXIF timestamp onto the test device — a
   screenshot works, or `adb push` a photo with EXIF stripped (e.g. via
   `exiftool -all= photo.jpg` before pushing, or PIL:
   `Image.open(...).save(..., exif=b"")`).
2. Pick it via "Choose from Library".
3. Confirm: `time_type` flips to `'manual'` in the submission cache (not
   `'device'`), the existing date-time-picker modal is triggered, and the
   entered value lands in `submission.manual_time`.
4. The EXIF-read → Manual-time trigger's exact code location was not
   pinned down this session — search `src/lib/` and the photo-picker hook
   (`src/hooks/useLibraryPhotoPicker.ts`) for where EXIF gets read and
   where `time_type` gets set.

## Verification technique (moved from README — only needed here and in #76)

To confirm the result, read the submission cache from app-private storage:
`adb shell run-as <pkg> find/ls` to locate files; `adb exec-out run-as <pkg>
cat <path>` (not `adb shell ... cat`, which corrupts binary output on
Windows via text-mode CRLF translation). Submission cache lives in
`databases/RKStorage` (SQLite, table `catalystLocalStorage`, key
`submission_cache_<uuid>`), not in the MMKV store.

## Suggested skills

- `tdd` — if this reveals a bug (not just confirms working behavior), model
  the time-type state machine (`device` / `manual`, trigger conditions)
  per [testing.md](../../agents/testing.md).
