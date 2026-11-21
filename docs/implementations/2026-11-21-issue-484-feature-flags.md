# Replace the version gate with build-time feature flags

**Scope:** refactor
**Issues/spec:** #484
**Date:** 2026-11-21
**Branch/PR:** `issue-484-feature-flags`

## Scope

**In scope:**

- [x] Gate each sign-in provider and the annotation tutorial with a feature flag.
- [x] Remove `isVersionReleased`, `getAppVersion`, `releasedInVersion` and
      `TUTORIAL_RELEASED_IN_VERSION`.

**Out of scope / not addressed:**

- The release workflow from #483 still strips `-rc.N` from the Expo
  `version`. The reason for that step is now gone. Change it on the #483
  branch.
- The `semver` dependency stays. The #483 branch uses it in `app.config.js`.

## Intent

**Purpose:** The version gate tied each feature to the app version. A build
with no version got `0.0.0` and lost Google sign-in. An RC version such as
`0.2.1-rc.1` sorts below `0.2.1` and closed its own gates.

## Design decisions and reasoning

### Flag tool

- **Decision:** Use the existing build-time `FEATURE_FLAGS` in
  `src/shared/config/constants.ts`. Do not use PostHog flags.
- **Reason:** `PostHogProvider` mounts only in RC builds, and only after data
  consent and analytics consent. Stable builds and users who decline would
  get no flag value. Build-time flags give every user the same value. They
  need no network, so "flag unavailable" cannot occur. They are kept in
  source control, as the feature-toggle guidance recommends
  ([Feature Toggles, martinfowler.com](https://martinfowler.com/articles/feature-toggles.html)).
- **Related:** `useOrganizationsFlag` already reads a PostHog flag without
  consent. It sends a random installation ID, not the user ID. Use that
  pattern if a flag must change without a release.

### Defaults

- **Decision:** `googleSignIn: true`, `appleSignIn: false`,
  `facebookSignIn: false`, `annotationTutorial: __DEV__`.
- **Reason:** These match the old gates for every `0.x` build. A build with
  no version now keeps Google sign-in.

## What shipped

- `FEATURE_FLAGS` gets four release flags.
- `FederatedProviderConfig.flag` replaces `releasedInVersion`.
  `isFederatedProviderReleased` takes the flags as an argument, like
  `visiblePhotoToggles`.
- `useAnnotationTutorial` reads `FEATURE_FLAGS.annotationTutorial`.
- `APP_VERSION` reads the Expo version directly.
- `src/shared/utils/appVersion.ts` is deleted.

## Tests

| Test file                                               | What it verifies                                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/features/auth/lib/__tests__/authProviders.test.ts` | The default flags release only Google. Each provider is released only by its own flag. |

**Not tested:** no device drive. The tutorial gate is a direct flag read.
