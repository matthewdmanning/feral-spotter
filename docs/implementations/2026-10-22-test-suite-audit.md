# Test suite audit

**Purpose:** remove tests and substitutes that can pass while application behavior
is broken, and use testing support shipped by the installed libraries.

**Change:** replaced the permissive Unistyles proxy with its official mock and
real app themes; removed duplicated AsyncStorage/MMKV mocks; used MMKV's built-in
in-memory implementation, Reanimated's public mock, and the supplied Worklets
resolver. Expo location overrides retain real exports and preset native mocks.
The active-cat and captured-photo suites now use real persisted stores, and
analytics consent checks real state. Sign-in and Onboarding render real AppButtons.

Press, long-press, and typing tests now await User Event interactions. Submit/reset
and cache-sync tests await real dialog callbacks instead of firing unobserved
promises or counting microtasks. The sign-in failure test waits for error handling.
Removed a duplicate pending-location test, subsumed model cases, a shallow empty
AlertHost check, and a still-uploading check superseded by the timeout/draft-survival
case. Replaced the formatting-sensitive touch-target source scanner with a rendered
shared-button floor check and disabled/loading interaction coverage. AlertHost
checks actual dismissal and chained rendering.

Testing resources and guidance are recorded in [testing.md](../agents/testing.md).
No production behavior changes are intended.

## Verification

- Baseline: 76 suites, 352 tests passed.
- Updated root Jest suite: 76 suites, 347 tests passed, with no late-log or act-environment warnings.
- `npm run typecheck`: passed.
- ESLint on all changed JavaScript/TypeScript files and the new button suite: passed without warnings.
- `git diff --check`: passed.
- Mutation probes: removing the loading disable gate failed the button interaction test; retaining a box on `markAbsent` failed the active-cat exclusivity test. Both production files were restored byte-for-byte afterward.
- Firebase rules/emulator suites, the separate Functions project, and device behavior were not run; their configuration and implementation were not changed.

## 2026-10-22 — review

**Purpose:** inspect every remaining test with independent reviewers and distinguish concrete weak assertions from legitimate isolation.
**Change:** six subagents reviewed all 79 current test files. The primary decisions and complete inventory are recorded in [the complete review](2026-10-22-test-suite-audit-review.md). 22 remaining redundant cases are recommended for removal; other accepted findings require stronger fixtures/outcomes. No test or production edits were made during this review. Corrected the testing guide to recognize the installed official in-memory FileSystem resource, which a reviewer runtime-verified.

## 2026-10-22 — semantic reassessment

**Purpose:** prioritize tests that cannot distinguish correct behavior from realistic regressions, rather than treating duplication or mocking as proof of low value.
**Change:** six reviewers reassessed all 79 files and ran 107 semantic probes in isolated current-tree snapshots: 78 assertion kills, 29 surviving defects, zero invalid outcomes counted. All 76 application suites / 347 tests passed their isolated baselines. Functions/rules remained static-only. The [primary decisions and evidence](2026-10-22-test-suite-audit-load-bearing.md) distinguish one ineffective sign-out assertion from useful partial guards. No tests or production files were changed; workspace source integrity was verified.

## 2026-10-22 — coverage remediation and final review

**Purpose:** close the demonstrated regression gaps, starting with uncertain fixtures
and asynchronous behavior before the clearly ineffective assertions.

**Change:** five lower-usage reviewers used a shared JSON template, recorded
confidence, and saved incremental JSONL findings and JSON snapshots in
`docs/implementations/2026-10-22-test-suite-audit-reports`. The primary reviewer checked their evidence
and resolved caveats rather than treating confidence as proof. All 29 application
defects that survived the earlier semantic probes now cause assertion failures.
This is a targeted check, not an exhaustive mutation score.

Tests now exercise real persisted stores for crop selection, consent, photo
workflows, and draft reset. Stronger cases cover navigation denial, location
commit/cancel, carousel completion, photo dimensions and canvas bounds, payload
associations, queued-upload failure recovery, and persisted submission completion.
SDK boundary cases cover real auth/upload wrappers, including Google's released
credential exchange, rejected sign-outs, exact metadata payloads, and offline
cleanup. The clearly ineffective Google sign-out assertion was replaced.

Backend fixtures now distinguish full counter/marker document paths and preserve
unrelated auth claims. Scheduled cleanup tests protect submitted, recent,
unknown-date, and different-owner objects. Real emulator tests cover ownership,
photo/submission caps, overwrite denial, and private server-managed documents.
Storage fixtures are recursively cleared in their actual bucket. The rules runner
selects Java 21+ on supported platforms and preserves the environment. A scoped
Firebase CLI preload corrects loopback proxy handling that otherwise made
cross-emulator Firestore reads appear missing. External requests retain their
configured proxy. Separate Functions and rules jobs were added to CI.

**Verification:** final application suite: 78 suites / 360 tests; Functions:
1 suite / 22 tests; real Firebase rules emulators: 2 suites / 36 tests. Root type
checking, Functions build, changed-file ESLint, formatting, and diff checks pass.
Six Functions mutations and six real-emulator rules mutations all fail assertions.
Application behavior and deployed rules were not changed. Native rendering,
provider prompts, and device integration still require device checks.

Earlier verification sections record historical snapshots; the previous statements
that Functions/rules were not run no longer describe this final remediation.

## 2026-10-23 — regression realism review

**Purpose:** check whether the tests and demonstrated regressions use attainable
application states and representative library contracts.

**Change:** five lower-usage agents reviewed all 81 current test files using the
same reporting schema with nullable `flaw_category` and `flaw_details`. Snapshots,
incremental reports, the complete inventory, and primary decisions are committed
under [the realism reports](2026-10-22-test-suite-audit-reports/realism/README.md).
The [primary review](2026-10-22-test-suite-audit-reports/realism/review.json) records
confidence and the following dispositions:

- Accepted two low-impact fixture issues: the upload serialization case casts an
  incorrect wire shape, and the draft teardown fixture uses out-of-range box
  coordinates. Both still assert useful behavior.
- Accepted a narrow mock-fidelity issue: the SegmentedControl test's permissive
  style proxy masks style contract failures while selection transitions stay real.
- Left the consent scenario uncertain: it asserts transmission without overall
  consent, bypassing ordinary route gating. Its intended transmission contract
  needs clarification before treating it as an unreachable or poor test.
- Rejected a screen finding after independently checking the actual render
  conjunction; the reviewer corrected its report.

This step is a static review. It does not change tests or application behavior,
and it does not establish that every possible regression is realistic. No new
runtime tests were run for this review; the previous validation remains applicable.
