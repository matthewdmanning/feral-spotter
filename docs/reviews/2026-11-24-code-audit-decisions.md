# Code audit — decisions

User decisions on the 2026-11-24 audit findings. Source reports:
`2026-11-24-code-audit-{duplication,mvvm,logic,navigation-ui,aesthetics-tokens}.md`.

## Logic

- **LOGIC-1 (P1)**: Every photo carries its own time (camera and Library).
  A Library photo without EXIF time is allowed at Submit, marked `unknown` —
  never the submit moment. Update ADR-0003.
- **LOGIC-2**: Pool empties → reset location and time to device. Any Library
  photo removal → reclassify time over the remaining photos.
- **LOGIC-3**: Date a photo draft by `max(photo updated_at, row updated_at)`.
- **LOGIC-4**: Per-photo times live only in `metadata.json` (single durable
  record). The post-upload Storage-metadata patch no longer carries times.
- **LOGIC-5**: Release a Submission's upload grant when its `metadata.json`
  lands. Specific user copy per refusal reason.
- **LOGIC-6**: On erasure, redact author on pin comments; delete pin
  reactions. Code comment: author redaction applies only to user-initiated
  account deletion.

## Navigation / UI

- **NAV-1 (P1)**: Data Agreement — first Back ignored, second Back declines
  (same as Consent Decline: "Permissions Required" warning, then minimize).
  Add a Deny button with the same behavior (none exists today).
- **NAV-3**: Home Continue and Sighting resume use `router.navigate`. Other
  push sites and NAV-2 unchanged.
- **NAV-4**: Add a compact `controlWidth` token so Annotate's three buttons
  fit at 1.0×; stack only at large text.
- **NAV-5**: Sightings map shows the current location with no pins when
  there are no Sightings. No location → center on the Great Sphinx
  (29.9753, 31.1376). Read failure → error card with Retry over the map.
- **Submit label**: code changes to "Finished!" to match
  `cat-list-empty-state.md`.
- **NAV-6**: `DialogShell` avoids the keyboard.
- **NAV-8**: Home circles sized from the measured area; Home scrolls on
  overflow. NAV-7 unchanged.
- **New bug (user report)**: Tapping Photo Library shows the consent screen
  again.

## Style

- **STYLE-1**: Switch off-track token at ≥3:1 both themes; on-accent thumb.
- **STYLE-6**: Date/Time trigger gets TextField's boundary.
- **STYLE-2**: One disabled/pressed opacity token set replaces raw literals.
- **STYLE-7**: Crop frame and crosshair use photo-overlay tokens; device
  check after.
- **STYLE-3/4, STYLE-T-2**: Move every literal to its copy owner. Rewrite
  narrating copy. No copy explaining obvious or detailed operation (e.g.
  what haptic feedback does). Add a lint guard for raw colors and JSX
  string literals.

## MVVM

- **MVVM-2/3/4**: Organizations Views move rules, API calls, idempotency
  keys and the draft-sync effect into hooks/lib.
- **MVVM-6/7**: Camera hook returns no JSX; gallery save moves to lib; one
  telemetry builder; unused members removed.
- **MVVM-1/5**: Atomic pin-location store action; email verify and reload
  go through `authProvider`.
- **MVVM-15/T-9**: Lint sub-feature isolation, `modules`→`src`, barrels,
  client imports from `functions/`.

## Tests

- Fix policy violations: DUP-T-1/2/5, MVVM-T-6/8.
- Failing-first regression test for every fixed bug (LOGIC-T-1..4, NAV-T-1).
- MVVM-T-1 capture-loop test; NAV-T-2/3 real-router and ButtonRow tests.

## P3s and delivery

- P3s: file GitHub issues grouped by lens.
- Delivery: one PR per lens (logic, navigation-ui, style, duplication,
  mvvm). Logic and navigation P1s first.

## Duplication

- **DUP-1/2/3**: One capture lifecycle, one map frame, one generic
  edge-handle gesture.
- **DUP-4/5**: Sharing fields use `SharingCheckbox`; cat form generated from
  `attributes.ts`.
- **DUP-6/7/8/9**: Single photo-format table, bucket name, contact limits,
  Stack `screenOptions`, shared by app and functions.
- **DUP-10/11**: PostHog SDK for flags; three listener stores move to
  Zustand.
