# #76 — Photo timestamps (parent) — closure tracking

[GitHub issue #76](https://github.com/matthewdmanning/feral-spotter/issues/76) · label `chore, needs-test-drive` · common context: [README](../README.md)

## Status: hold open, don't close yet

Capture → local-cache stage is verified working for both entry paths
(Camera and Library Pick with EXIF present) — see the GitHub comment
thread for full detail, not duplicated here.

## Verification technique (moved from README — only needed here and in #224)

App-private storage extraction: `adb shell run-as <pkg> find/ls` to locate
files; `adb exec-out run-as <pkg> cat <path>` (not `adb shell ... cat`) to
pull binaries without corruption (plain `adb shell ... cat` corrupts binary
output on Windows — text-mode CRLF translation). Submission cache lives in
`databases/RKStorage` (SQLite, table `catalystLocalStorage`, key
`submission_cache_<uuid>`), not in the MMKV store (`files/mmkv/feralspotter`
turned out to hold none of the app's own stores this session).

**Remaining before this can close:**

- [#224](../224-library-pick-manual-time-fallback.md) — Manual-time fallback
  (Library pick of a photo with no EXIF) is untested, split into its own
  Alpha-scoped ticket.
- Upload stage (server-side receipt of these timestamp values) was never
  in scope for the device-only drive that produced today's findings — needs
  a separate pass, not covered by any current ticket.

## Suggested skills

- None directly — this ticket just tracks closure of its two remaining
  sub-scopes. Close it once #224 lands and the upload-stage check has a
  home (new ticket or folded into a release-checklist item).
