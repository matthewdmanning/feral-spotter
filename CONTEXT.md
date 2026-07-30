# FeralSpotter

A mobile app for reporting feral-cat sightings: users spot a cat, capture photos and details, and submit them to a research database used by rescue volunteers and ecology researchers.

## Language

### First-run and gating

**Onboarding**:
The first-run flow that explains the app's purpose and why each permission will be needed. It informs only — it does not grant permissions or record acceptance. Realized in code as the `intro-flow` route/folder.
_Avoid_: tutorial, walkthrough.

**Tutorial**:
In-feature guidance that shows the user how to operate a _complex_ part of the app. In FeralSpotter the (planned) tutorial teaches the Box Annotation operation. Distinct from Onboarding. **Not implemented** — only scaffolded, then deferred (issue #30).
_Avoid_: using this word for anything in the Onboarding flow.

**Box Annotation**:
Drawing a bounding box around each cat in a photo. The app's one genuinely complex operation — the reason a Tutorial is warranted. **Not implemented yet.**

**Consent**:
The user's explicit acceptance of the data-collection disclosure, and the granting of OS permissions (location, camera, photos). This is where acceptance is recorded and permissions are requested — unlike Onboarding, which only explains. Eager priming happens on "I Agree"; contextual re-priming happens at point of use (issue #41).
_Avoid_: onboarding (Consent is the gate, not the explanation).

### Sign-in and authentication

**Federated Sign-In**:
The user proves who they are through an identity provider's _own_ external portal (its account picker or a browser it controls) and the app receives an identity token back. The app never sees or collects the provider password. Every sign-in option FeralSpotter offers — Google, Apple, Facebook — is Federated Sign-In.
Equivalent terms: social login, third-party login.

**Registration**:
A user's initial authenticated entry into the app through Firebase Authentication, via any provider (Google, Apple, Facebook, or email/password). Distinct from a returning sign-in, which authenticates an already-registered user.
_Avoid_: sign-up (prefer Registration), onboarding (that is the first-run explainer, not authentication).
