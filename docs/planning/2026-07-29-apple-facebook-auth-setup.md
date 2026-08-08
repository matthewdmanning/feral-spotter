# Apple + Facebook Federated Sign-In — external setup checklist

Code is fully wired on `issue-7-firebase-auth-migration`. Both buttons are **gated off** by a
release/version tag (`releasedInVersion: '1.0.0'` in `src/lib/auth/authProviders.ts`) because the
steps below — Firebase Console + external developer accounts — are not done yet, and neither is
testable on the Android emulator (Apple = iOS-only; Facebook needs a real FB app).

**To unblock:** finish a provider's checklist, then ship the app at a version `>= 1.0.0` (or lower
that provider's `releasedInVersion` to the release you're cutting). The button activates when the
running app version reaches the tag.

---

## Google (already live — reference)

Google is enabled and works in dev via the mock. For a **real** Google sign-in:

- Firebase Console → Authentication → Sign-in method → enable **Google**. (This is the likely fix
  for the earlier `INTERNAL_ERROR` — Console had only Email/Password on.)
- Android debug SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` is already
  registered. **EAS/release builds sign with a different key** — register that SHA-1 too before prod.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is the Web (type-3) OAuth client. ✓

## Email / Password (Credential Entry — live)

- Firebase Console → Authentication → Sign-in method → **Email/Password** enabled (already on).
- Nothing else required; sign-in + Registration screens are wired.

---

## Apple

Code: `src/lib/auth/AppleSignIn.ts` + `firebaseAuthProvider.ts` (`OAuthProvider('apple.com')`).
Plugin: `expo-apple-authentication` + `ios.usesAppleSignIn: true` (already in `app.json`).

1. **Apple Developer account** (paid membership required).
2. Register an **App ID** with the _Sign In with Apple_ capability for the iOS bundle identifier.
   - Note: `app.json` has **no `ios.bundleIdentifier` yet** — set one before an iOS build.
3. Create a **Services ID** and a **Sign In with Apple key** (.p8); note the Key ID and Team ID.
4. **Register an iOS app in the Firebase project** — the project is currently **Android-only**
   (no iOS app, no `GoogleService-Info.plist`). Add it and download the plist.
5. Firebase Console → Authentication → Sign-in method → enable **Apple**; fill Services ID, Team ID,
   Key ID, and the private key.
6. Build for iOS (`expo prebuild` + an iOS build via EAS or a Mac). Cannot be tested on Android.

## Facebook

Code: `src/lib/auth/FacebookSignIn.ts` + `firebaseAuthProvider.ts` (`FacebookAuthProvider.credential`).
Plugin: `react-native-fbsdk-next` in `app.json` — **currently holds placeholders**:
`REPLACE_WITH_FACEBOOK_APP_ID`, `REPLACE_WITH_FACEBOOK_CLIENT_TOKEN`, `scheme: fbREPLACE_...`,
and `isAutoInitEnabled: false`.

1. **Facebook Developer account** → create an app at developers.facebook.com → add **Facebook Login**.
2. Copy the **App ID** and a **Client Token** (Settings → Advanced).
3. In `app.json`, replace the three placeholder values; set `scheme` to `fb<APP_ID>`; flip
   `isAutoInitEnabled` to `true` if you want SDK auto-init.
4. Add the Android key hash (and iOS bundle id) in the Facebook app's Login settings.
5. Firebase Console → Authentication → Sign-in method → enable **Facebook**; paste App ID + App Secret.
6. `expo prebuild --clean` + rebuild. Cannot be functionally tested until the FB app exists.

---

## Flipping a provider live

In `src/lib/auth/authProviders.ts`, each provider has `releasedInVersion`. A button is pressable once
`getAppVersion() >= releasedInVersion`. Options:

- bump `app.json` `expo.version` to the tag (e.g. `1.0.0`), or
- lower that provider's `releasedInVersion` to the version you are shipping.

Do this **only** after its Console + external setup above is complete, or real sign-in will fail.
