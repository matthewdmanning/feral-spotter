# Secrets & credentials — safe vs. sensitive

This file is **public** (`docs/` is the `feral-spotter-docs` submodule, a
public repo) — never put an actual secret value, filepath-to-resource
mapping, or restriction-status notes here. Its only job is to stop a future
session from false-alarming on a value that's meant to be public, or from
missing one that isn't. Classification only.

Read this before treating a found API key/token as a leak, or before
deciding whether an `.env*` file, `google-services.json`, or
`GoogleService-Info.plist` is safe to commit.

## Safe to commit / not a leak

- **PostHog Project API Key** (`phc_...`) — write-only (capture events,
  identify users, evaluate flags), no read access to data or project
  settings, designed by PostHog to ship in client-side code.
- **OAuth client id** values — public by Google's own design, not just "not
  secret under our own model."

## Sensitive — treat as a real credential if found in a diff

- **Cloud resource identifiers/paths** — Firebase/GCP **project id**,
  **storage bucket name**, and similar. Not secrets under Firebase's own
  security model in the abstract (protection is enforced by
  `storage.rules`/`firestore.rules`, not by hiding these) — treated as
  sensitive here by policy decision (2026-08-16), independent of that
  model, because a bucket migration is planned and the intent going forward
  is for cloud resource identifiers not to accumulate in public history.
  The *current* project id/bucket name are left as-is in `firebase.json`,
  `firebaseUpload.ts`, `.firebaserc`-adjacent docs, etc. — already public
  from before this policy, and scrubbing them now would require CLI-usable
  env-var wiring for no real benefit since they're still live/in-use. Once
  a resource is migrated, keep the *new* identifier out of committed files
  in both this repo and the docs repo; ask the user how before touching
  `firebase.json`'s deploy-time bucket reference specifically, since the
  Firebase CLI reads that file directly with no built-in env-var
  interpolation.
- Any Expo/EAS **CI auth token** (`EXPO_TOKEN` or similarly named) — grants
  non-interactive publish/build access to the account.
- Any **Google Maps Platform** key — not safe merely by being out of git,
  since it ends up baked into the built app binary regardless. This
  project's key is confirmed API- and app-restricted as of 2026-08-16 (see
  `.agents/secrets.md` for detail) — don't assume a *new* key elsewhere is
  restricted without checking.
- PostHog **Personal API Keys** (`phx_`, admin-level) and **Project Secret
  API Keys** (`phs_`, server-to-server) — unlike the Project API Key above,
  these are real secrets and must never be client-side or committed.
- Firebase Admin SDK service account JSON, and any per-app config file this
  repo's `.gitignore` already excludes — if you find one of those tracked
  when it shouldn't be, that's a real finding, not a false alarm.
