# Rebuild verification drive — 2026-08-15

Git state: `2357000074494fbe9aa4db35a7f059b6e0543b36` on branch `code-simplification-review`.
Device: Pixel 7 physical (`2A151FDH200HY4`), fresh arm64-v8a build post `expo prebuild --clean` (relinks `@react-native-firebase/storage`).

Continuing from `docs/scratchpad/2026-08-15-code-simplification-review-rebuild-handoff.md`'s
"What to do once the app is rebuilt" list.

## Blocker: Google Sign-In fails, cannot get past sign-in screen

`EXPO_PUBLIC_AUTH_MOCK=false` in `.env.local` (not `true` as prior session
notes assumed — config has drifted) — this run is against real Firebase
Auth, not mock.

Walked onboarding -> data agreement -> camera permission (while using app)
-> location permission (precise, while using app) -> sign-in screen ->
tapped "Continue with Google" -> picked `mattmanningclemson@gmail.com` from
the native account chooser -> **"Sign-in failed / Something went wrong
signing in. Please try again."**

App-scoped logcat (pid 20548):
```
E ReactNativeJS: '[sign-in] google failed:', [Error: [auth/unknown] Exception in HostFunction: accessToken cannot be empty]
```

Not a credentials problem — the native Google account picker completed
normally, then the JS/native bridge call into `@react-native-google-signin/google-signin`
returned no `accessToken` (only `idToken`, likely), which the app's sign-in
code requires. Looks like a Google Sign-In library / Credential Manager API
version mismatch, not anything touched this session. Blocks **all** further
test-driving — every subsequent screen requires an authenticated user.

Email/password sign-in is also real Firebase Auth (not mocked) with
`AUTH_MOCK=false`, so it's not a viable workaround without valid
credentials either.

**Stopped here rather than flipping `AUTH_MOCK` or attempting workarounds
unilaterally — flagged to Matthew instead.**

**Fixed** in `d28dad3` (`fix(auth): fetch a real accessToken for Google
sign-in`): `GoogleSignin.signIn()` only returns an idToken post-Credential
Manager migration; `GoogleAuthProvider.credential(idToken)` alone crashes
native-side because RNFB's Android bridge sends the omitted accessToken arg
as `""` rather than `null`. Now fetches a real accessToken via
`GoogleSignin.getTokens()` and passes both. JS-only change, not yet
re-verified live on-device — drive cut short here for time. Next session:
relaunch (app + Metro already running against this build) and confirm
Google sign-in actually completes before resuming the rest of the punchlist.
