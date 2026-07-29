# FeralSpotter

A mobile app for reporting feral-cat sightings: users spot a cat, capture photos and details, and submit them to a research database used by rescue volunteers and ecology researchers.

## Language

### First-run and gating

**Onboarding**:
The first-run flow that explains the app's purpose and why each permission will be needed. It informs only — it does not grant permissions or record acceptance. Realized in code as the `intro-flow` route/folder.
_Avoid_: tutorial, walkthrough.

**Tutorial**:
In-feature guidance that shows the user how to operate a _complex_ part of the app. In FeralSpotter the (planned) tutorial teaches the Annotation operation. Distinct from Onboarding. **Not implemented** — only scaffolded, then deferred (issue #30).
_Avoid_: using this word for anything in the Onboarding flow.

**Annotation**:
The operation of marking up a captured photo to describe a spotted cat (e.g. ear tip, coat pattern, condition) as part of a submission. The app's one genuinely complex operation — the reason a Tutorial is warranted. **Not implemented yet.**

**Consent**:
The user's explicit acceptance of the data-collection disclosure, and the granting of OS permissions (location, camera, photos). This is where acceptance is recorded and permissions are requested — unlike Onboarding, which only explains. Eager priming happens on "I Agree"; contextual re-priming happens at point of use (issue #41).
_Avoid_: onboarding (Consent is the gate, not the explanation).

### Sign-in and authentication

**Federated Sign-In**:
The user proves who they are through an identity provider's _own_ external portal (its account picker or a browser it controls) and the app receives an identity token back. The app never sees or collects the provider password. Every sign-in option FeralSpotter offers — Google, Apple, Facebook — is Federated Sign-In.
_Avoid_: social login, third-party login.

**Google Login** (also "Sign in with Google"):
Federated Sign-In using the user's Google account. The user selects their account in Google's external portal — they do **not** type a Gmail address and password into FeralSpotter.
_Avoid_: Gmail login, email/password (implies in-app credential entry, which this is not).

**Credential Entry**:
Signing in by typing an email address and password directly into the app — the non-federated path, distinct from Federated Sign-In. Backed by the email/password identity store.
_Avoid_: email login, password login (do not use these for the Google/Apple/Facebook options — those are Federated Sign-In).

**Registration**:
Creating a new Credential Entry account by choosing an email address and a password in the app. Distinct from signing in, which authenticates an account that already exists.
_Avoid_: sign-up (prefer Registration), onboarding (that is the first-run explainer, not account creation).
