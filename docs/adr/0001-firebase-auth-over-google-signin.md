---
status: accepted — supersedes the "Auth: Google Sign-In" decision in the 2026-07-12 MVP roadmap doc and Issue #7's original rationale
---

# Firebase Auth (Google provider), not raw Google Sign-In

The 2026-07-12 MVP roadmap chose raw `@react-native-google-signin/google-signin` over Firebase specifically for per-tester attribution — tracing a field submission back to a specific tester/device. That reasoning no longer holds: Firebase Auth's `uid` gives the same per-user attribution, and its native session persistence (via `@react-native-firebase/auth`) additionally solves cold-start offline restore for already-registered users, which raw Google Sign-In alone did not provide. Reversed 2026-07-27 to use `@react-native-firebase/auth` with the Google provider, bridging the existing `GoogleSignIn.ts` idToken into `signInWithCredential`. Android-only for now, matching the standing MVP platform decision.

## Considered Options

- **Raw Google Sign-In** (original 7/12 choice) — rejected: no native session persistence story, and the attribution rationale is equally served by Firebase's `uid`.
- **Firebase JS SDK** (`firebase/auth`) — rejected: weaker auth-persistence guarantees outside a web context; app already ships several native modules via config plugins (vision-camera, permissions, google-signin), so native `@react-native-firebase/auth` fits the existing build shape better.
