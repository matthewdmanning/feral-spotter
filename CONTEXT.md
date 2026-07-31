# FeralSpotter

A mobile app for reporting feral-cat sightings: users spot a cat, capture photos and details, and submit them to a research database used by rescue volunteers and ecology researchers.

## Language

### Sighting & location

**Submission**:
One reported feral-cat sighting — the unit the user builds and sends. Holds one or more photos and exactly one location.
_Avoid_: report, observation, entry

**Submission location**:
The single geographic point a Submission is tagged with, shared by every photo in it. An app-level value the user sees and (in some paths) sets; it is not the same thing as a photo's embedded EXIF. One Submission has one Submission location — separate places require separate Submissions.
_Avoid_: metadata, geotag, coordinates (when referring to the app-level value)

**Live fix**:
A device GPS reading taken once per Submission at camera-capture time. Trusted as authoritative for camera-captured photos and therefore not user-editable.
_Avoid_: GPS location, current location, geolocation (as a noun for the value)

**Map picker**:
The manual location-selection surface: a native, draggable map with a fixed center pin. The Submission location is whatever point sits under the pin when the user confirms. Used for uploaded photos and as the fallback when a Live fix is unavailable.
_Avoid_: map view, location selector, place picker

**Photo EXIF**:
The metadata tags physically embedded in an image file (including any GPS the source camera wrote). Read-only to this app — a possible _seed_ for the Map picker, never the Submission location itself, and never rewritten by us.
_Avoid_: photo metadata (as a synonym for Submission location)

### First-run and gating

**Onboarding**:
The first-run flow that explains the app's purpose and why each permission will be needed. It informs only — it does not grant permissions or record acceptance. Realized in code as the `intro-flow` route/folder.
_Avoid_: tutorial, walkthrough.

**Tutorial**:
In-feature guidance that shows the user how to operate a _complex_ part of the app. In FeralSpotter the tutorial teaches the Box Annotation operation. Distinct from Onboarding. Implemented, version-gated (see `src/config/tutorial.ts`'s `isTutorialReleased()`).
_Avoid_: using this word for anything in the Onboarding flow.

**Box Annotation** ("Box the Cat"):
Drawing a bounding box around each cat in a photo. The app's one genuinely complex operation — the reason a Tutorial is warranted. User-facing term: "Box the Cat." Implemented (`src/screens/submission/annotate/`).

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
