# Photo Library Consent Design Decision

## Context

- "Choose from Library" entry point — the photo-library picker a user reaches when adding photos to a submission draft from their device's existing photo library, as opposed to the camera.
- Fires the first time within a draft that the user attempts to pick from the library; the picker itself is the surface where this consent decision applies.

## Design Specifications

- Photo-library access is treated as granted only on an explicit affirmative response from the user — never inferred from the mere absence of a decline.
- A partial/limited grant (e.g. "Select Photos") counts as an affirmative yes and the picker proceeds normally.
- An explicit decline shows the user a message explaining that access was denied, with a path to enable it in Settings.
- Once access has been affirmatively granted, later picks proceed directly to the picker without re-asking.

## Reason

- The user must be told, in an explicit step, exactly what access they're being asked to grant, so consent is legible rather than an implicit side effect of opening a picker.
- A user who declines must receive clear feedback, so declining doesn't read as the app silently malfunctioning.
- Treating "didn't say no" as consent risks granting access the user never intended to grant, which erodes trust in how the app handles their data.
