# PostHog Audit Report

## Summary

This audit covered the Expo/React Native mobile runtime and found sound initialization and identity handling. The main issues are an outdated SDK observed in live traffic, stale declared dependency ranges, direct ingest without a first-party proxy, missing explicit signup capture, and unwired error alerts.

**Counts**

- **Errors**: 1 (must fix)
- **Warnings**: 3 (should fix)
- **Suggestions**: 1 (nice to have)
- **Passes**: 9

**Problematic items**

| Severity     | Area          | Check                                  | File                                              | Details                                                                                                                  |
| ------------ | ------------- | -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `error`      | Live Data     | SDK out of date                        |                                                   | Update the affected PostHog SDK dependency and lockfile, review required migration changes, and redeploy.                |
| `warning`    | Installation  | SDK version up to date                 | `package.json:36`                                 | Installed ranges posthog-react-native ^4.54.2 / @posthog/core ^1.55.3; latest 4.87.3 / 1.69.2.                           |
| `warning`    | Event Capture | Captures route through a reverse proxy | `src/providers/AppProviders.tsx:195`              | Mobile SDK receives the configured default PostHog ingest host; no first-party reverse proxy is evidenced.               |
| `warning`    | Event Capture | Key activation events captured         | `src/features/auth/screens/register/index.tsx:31` | Registration has no explicit signup event; activation is captured, and no billing purchase/subscription flow is present. |
| `suggestion` | Live Data     | Error alerts not wired                 |                                                   | No alert is wired for issue-created, issue-reopened, or issue-spiking error conditions.                                  |

## Recommended actions

1. **Live Data · SDK out of date** — PostHog observes an outdated `posthog-react-native` version in recent traffic. _Why it matters:_ Old clients can omit fixes and emit data differently from the version your analysis assumes. _Fix:_ Upgrade the SDK and lockfile, review migration changes, redeploy, and confirm old traffic ages out. See [React Native SDK docs](https://posthog.com/docs/libraries/react-native).
2. **Installation · SDK version up to date** — The declared PostHog dependency ranges in `package.json` lag the latest published minors. _Why it matters:_ Stale SDKs can preserve known capture, identity, or session-recording defects that bias downstream analytics. _Fix:_ Update both PostHog dependency ranges at `package.json:36`, regenerate the lockfile, and verify the app. See [React Native SDK docs](https://posthog.com/docs/libraries/react-native).
3. **Event Capture · Captures route through a reverse proxy** — The mobile client sends directly to the configured PostHog ingest host rather than a first-party relay. _Why it matters:_ Network-level blocking can silently remove events and undercount funnels, retention, and active users. _Fix:_ Configure a supported first-party ingest proxy and point the host option at it in `src/providers/AppProviders.tsx:195`. See [proxy docs](https://posthog.com/docs/advanced/proxy).
4. **Event Capture · Key activation events captured** — Registration succeeds without an explicit signup event, while activation is tracked and no billing flow exists. _Why it matters:_ Without a signup event, acquisition-to-activation funnels cannot reliably distinguish newly registered users from restored sessions. _Fix:_ Capture one static signup event after successful registration at `src/features/auth/screens/register/index.tsx:31`. See [capture events docs](https://posthog.com/docs/product-analytics/capture-events).
5. **Live Data · Error alerts not wired** — No alert is configured for newly created, reopened, or spiking error issues. _Why it matters:_ Errors can accumulate unnoticed, delaying discovery even though exception data is captured correctly. _Fix:_ Add the relevant notifications in Error tracking → Alerts. See [error tracking docs](https://posthog.com/docs/error-tracking).

## Full audit

### Installation

Whether the PostHog SDK is present, current, and initialized the way the framework expects. Everything downstream depends on this: a missing or stale SDK silently changes which events exist and which config options are honoured.

| Check                          | Status    | File                                 | Details                                                                                                         |
| ------------------------------ | --------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| PostHog SDK installed          | `pass`    | `package.json:36`                    | posthog-react-native@^4.54.2 and @posthog/core@^1.55.3                                                          |
| SDK version up to date         | `warning` | `package.json:36`                    | Installed ranges posthog-react-native ^4.54.2 / @posthog/core ^1.55.3; latest 4.87.3 / 1.69.2.                  |
| Initialization is correct      | `pass`    | `src/providers/AppProviders.tsx:184` | Expo root mounts one env-sourced PostHogProvider in the mobile runtime; both required variables are configured. |
| One initialization per runtime | `pass`    | `src/providers/AppProviders.tsx:184` | One production mobile initialization; the separate constructor in test utilities is test-only.                  |

#### Assumptions and blind spots

Native generated code and every transitive SDK initialization path were not exhaustively inspected. Static code cannot prove which dependency version is deployed on every installed device, and old mobile releases can continue sending after the manifest changes. The live SDK-health finding supports that alternative explanation. Verify the active version distribution on PostHog's SDK Health page after releasing an upgrade.

### Identification

Whether the same human maps to one stable `distinct_id` across sessions, runtimes, and logins. Identity defects are the most expensive kind to fix after the fact, because they corrupt person counts, funnels, and retention retroactively rather than going forward.

| Check                                          | Status | File                                 | Details                                                                                                                      |
| ---------------------------------------------- | ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Stable distinct_id (not session UUID)          | `pass` | `src/providers/AppProviders.tsx:134` | identify() uses the authenticated Firebase user's stable UID.                                                                |
| identify() called before captures / flag evals | `pass` | `src/providers/AppProviders.tsx:134` | Identification runs when auth restoration completes and before registered capture paths are used for the authenticated user. |
| Same distinct_id across client and server      | `pass` | `src/providers/AppProviders.tsx:184` | Single runtime; no server-side PostHog initialization detected.                                                              |
| reset() called on logout / account switch      | `pass` | `src/providers/AppProviders.tsx:124` | Central auth bridge resets on logout and again before switching identified accounts.                                         |

#### Assumptions and blind spots

_No findings to qualify; the standard checks for this area passed cleanly._

### Event Capture

Whether events are named consistently, reach PostHog reliably, and cover the moments the business actually reasons about. Gaps here don't break anything visibly; they just leave the questions you want to ask unanswerable.

| Check                                  | Status    | File                                              | Details                                                                                                                     |
| -------------------------------------- | --------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Event names are static and consistent  | `pass`    | `src/shared/analytics/analytics.ts:79`            | No direct posthog.capture() call uses a dynamic name; the centralized wrapper accepts only the static EVENTS contract type. |
| Captures route through a reverse proxy | `warning` | `src/providers/AppProviders.tsx:195`              | Mobile SDK receives the configured default PostHog ingest host; no first-party reverse proxy is evidenced.                  |
| Key activation events captured         | `warning` | `src/features/auth/screens/register/index.tsx:31` | Registration has no explicit signup event; activation is captured, and no billing purchase/subscription flow is present.    |

#### Assumptions and blind spots

The static scan focused on the capture patterns and growth surfaces defined by the audit program, not every behavioral path. It cannot prove delivery rates or whether consent and release-candidate gates suppress intended production traffic. The lack of billing capture may be correct because no billing surface was detected. Verify recent signup and activation volumes, expected consent rates, and client delivery by release in PostHog.

### Live Data

What PostHog itself has already flagged for this project, read from its recommendations and health checks. These come from ingested data rather than source code, so they catch problems no static scan can see — stack frames that never resolve, syncs that keep failing, alerts nobody wired up.

| Check                    | Status       | File | Details                                                                                                                                                     |
| ------------------------ | ------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open findings in PostHog | `pass`       |      | 2 open findings from PostHog.                                                                                                                               |
| SDK out of date          | `error`      |      | Update the affected PostHog SDK dependency and lockfile, review required migration changes, and redeploy.                                                   |
| Error alerts not wired   | `suggestion` |      | No alert is wired for error-tracking-issue-created, error-tracking-issue-reopened, or error-tracking-issue-spiking; set them up in Error tracking → Alerts. |

#### Assumptions and blind spots

These findings reflect what PostHog has observed in the recent lookback window, so a project that has just started sending data, or one whose findings haven't been recomputed yet, can show a clean area without being clean. Old app releases may continue contributing outdated SDK traffic after an upgrade. Recommendation completion can also lag a configuration change. Recheck SDK Health and Error tracking recommendations after the next production release.

### Write report

Whether the local markdown audit artifact was created successfully.

| Check                          | Status    | File | Details                                           |
| ------------------------------ | --------- | ---- | ------------------------------------------------- |
| Create posthog-audit-report.md | `pending` |      | This row is resolved after the report is written. |

#### Assumptions and blind spots

The pending status reflects the ledger snapshot used to generate this document; it is resolved immediately after the file exists.

### Upload notebook

Whether the local report was mirrored into a shareable PostHog notebook and verified.

| Check                                    | Status    | File | Details                                                      |
| ---------------------------------------- | --------- | ---- | ------------------------------------------------------------ |
| Write the report into a PostHog notebook | `pending` |      | This row is resolved after notebook upload and verification. |

#### Assumptions and blind spots

The pending status reflects the pre-upload ledger snapshot. Notebook completeness is verified separately by reading the cloud copy back before this row is resolved.

## About this audit

The PostHog wizard runs this audit in stages: SDK installation → init correctness → identification → event capture → live data → this report. The early stages resolve checks against the project's source tree. The live-data stage reads what PostHog already computed from your ingested data — things no source scan can see, like whether stack frames actually resolve. Every result, pass or otherwise, is recorded in the ledger this report was generated from.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.
