# Project Structure

## System Context

FeralSpotter is part of a three-component system:

- **FeralSpotter** (this repo) — mobile observation app
- **FeralSegmentor** — computer vision model for species segmentation
- **FeralTracker** — ecological modeling and population tracking

No integration between FeralSpotter and the other two components before the v2.0 milestone (see Status below) — MVP/Alpha/Beta upload to a shared GCP bucket only, with no pipeline coupling.

## Directory Layout

```
src/
├── app/          # Expo Router routes (thin re-exports only)
├── screens/      # Screen-level components and state
├── components/   # Atomic Design: atoms → molecules → organisms
├── hooks/        # Zustand stores and feature hooks
├── lib/          # Auth, cache, analytics
├── utils/        # Pure functions
└── config/       # Constants and feature flags
```

Dependency direction is strictly one-way: `app/` → `screens/` → `hooks/components/lib/` → `utils/config/`. No upward imports.

## Status

Tracked via GitHub Milestones + Issues (source of truth: [milestones](https://github.com/matthewdmanning/feral-spotter/milestones), [project board](https://github.com/users/matthewdmanning/projects/1)).

| Milestone | Scope | Due |
|---|---|---|
| **MVP** | Android build for a small trusted tester group. Real GCS upload, validation-only backend, Google Sign-In auth, minimal consent screen. No FeralSegmentor/FeralTracker integration. | 2026-08-01 |
| **Alpha** | Google Play Store release (Android). Data-transparency website live. Tutorial flow. Sentry crash reporting. Auth/registration design revisited. | 2026-09-07 |
| **Beta** | iOS support, feature parity with Alpha. | — |
| **v2.0** | FeralSegmentor / FeralTracker integration. | — |

Design rationale for this roadmap: `docs/design/2026-07-12-mvp-alpha-beta-roadmap.md`.
