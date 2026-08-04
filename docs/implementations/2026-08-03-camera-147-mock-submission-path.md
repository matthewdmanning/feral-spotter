# Sprint:camera — #147 mock submission path for testing (2026-08-03)

Implements #147, part of #144 (Camera flow: user-test-drive UI fixes,
2026-08-02), first sprint per
`docs/design/2026-08-03-punchlist-triage-sprints.md`. Branch
`issue-144-camera`, off fresh `origin/main` (`4546fae`). Code complete.

## What shipped

`submitObservation` (`src/utils/api.ts`) posted to a placeholder Cloud
Run URL (`https://YOUR-SERVICE-PROJECT-ID...`) with no real backend
behind it, blocking manual test-drives from completing a full
capture → cat-observations → submission run. Added a dev-only
`IS_MOCK_BACKEND` gate (`__DEV__ && !process.env.EXPO_PUBLIC_API_BASE_URL`,
same shape as the existing `DEV_STUB_PASSWORD` precedent in the same
file) that short-circuits `submitObservation` to a fake `{status:
'success', id: 'mock-<timestamp>'}` response instead of hitting `fetch()`.

## Prettier correction mid-session

`src/utils/api.ts` predates this repo's prettier adoption (double
quotes, semicolons, unformatted). First instinct was to hand-format only
the new `#147` lines to match the file's existing style, to avoid an
unrelated-looking diff. That was wrong for this repo: `scripts/format-changed.mjs`
(the CI formatting gate) checks **full-file** prettier compliance for
any file touched versus the merge-base, not just diff hunks — it's an
intentional "gradual rollout" convergence mechanism (see the script's own
comment, and precedent commit `02bbb28 style: prettier formatting pass on
shutter-photopicker-state.md`). Reran the full-file `prettier --write`
and committed it as its own `style:` commit, separate from the logic
change.

## Tests written

`__tests__/utils/api.test.ts`: new case asserting `submitObservation`
resolves a mock `success` response without hitting `fetch()`, when
`EXPO_PUBLIC_API_BASE_URL` is unset in a dev build — the real module
wasn't exercised anywhere else (the submission-flow test only ever
module-mocks `submitObservation`).

## Verification status

Gates run and passing: full `jest` suite (23 suites / 84 tests), `tsc
--noEmit`, `expo lint` (0 errors, pre-existing require()-in-tests
warnings only), `scripts/format-changed.mjs --check` against
`origin/main`.

**Not run on-device.** A prior on-device session for #145/#146 (same
branch, same emulator) _was_ a dev build with `EXPO_PUBLIC_API_BASE_URL`
unset (so `IS_MOCK_BACKEND` was `true` throughout), but the session was
torn down after the camera-flow checks without pushing a submission
through to exercise this path. Covered instead by the
`__tests__/utils/api.test.ts` case against the real module. Given the
mock is a trivial dev-only `return {status: 'success', ...}`, gated on a
config value confirmed unset, and a broken mock fails loudly and visibly
on the very next test-drive, this was judged not to block the sprint —
flagging here so it isn't mistaken for a full runtime pass.
