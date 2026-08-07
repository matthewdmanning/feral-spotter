# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Repo-specific label (not part of the five canonical roles)

| Label                | Meaning                                                                                                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `needs-verification` | Related/adjacent work landed since this issue was filed, but nobody has confirmed live whether it actually fixed _this_ issue's exact symptom. Distinct from `needs-info` (waiting on the reporter) — here the ball is in an agent/dev's court to go check. |

## Milestones

Tracked via GitHub Milestones + Issues (source of truth: [milestones](https://github.com/matthewdmanning/feral-spotter/milestones), [project board](https://github.com/users/matthewdmanning/projects/1)).

| Milestone | Scope                                                                                                                                                                              | Due        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **MVP**   | Android build for a small trusted tester group. Real GCS upload, validation-only backend, Google Sign-In auth, minimal consent screen. No FeralSegmentor/FeralTracker integration. | 2026-08-01 |
| **Alpha** | Google Play Store release (Android). Data-transparency website live. Tutorial flow. Sentry crash reporting. Auth/registration design revisited.                                    | 2026-09-07 |
| **Beta**  | iOS support, feature parity with Alpha.                                                                                                                                            | —          |
| **v2.0**  | FeralSegmentor / FeralTracker integration.                                                                                                                                         | —          |

Design rationale for this roadmap: `docs/design/2026-07-12-mvp-alpha-beta-roadmap.md`.
