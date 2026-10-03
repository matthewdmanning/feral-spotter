# Notes from User Test Drive

## Auth

-No device auth checks are displayed. Verify this is correct behavior.

## Location Finding

-GPS is the default method for location finding.
-GPS gathering begins when opens camera or file picker -> Hardens against slow GPS resolution.
-Pin drop and address are backups presented only if GPS fails or accuracy is low.

## Feral Spotter - Camera Icon Page

-Camera icon needs text label.
-Button for transition to manual photo upload screen needs to be added.
-Tab and upper right button for Settings. Keep tab, remove the button.

## Device Camera Page

-X on photo is too small for removal. Remove X button.
-Replace X button with gesture: Swipe Up to remove.

## Submission Details Page

-Replace "Location Type" with a check or Yellow "!".
-Yellow "!" is displayed if GPS accuracy is low or if no location is found.
-User can tap the Location Type -> Links to map pin drop if rendering is possible.
-If map rendering nor GPS are available, user is prompted to remember the address and enter it later. -> Implementation of later entry in post-release update.
-Replace "Time Type" section with a single box displaying "Date & Time Recorded".
-Incomplete information is displayed the same way as GPS low accuracy. User enters the information manually using existing modal.
-Increase font size and center "Cats Recorded" label.
\-_Always Present_: Box at the bottom of the list of cats with a "Add a Cat" label. Links to a new "Cat Observations" entry.
-Move the "Done" button currently in the "Cat Observations" page to "Submission Details" page.

## Cat Observations Page

-Remove the "Identity" and "Condition" text boxes
-Move "Hair Length" section above "Pattern" section
-"Color" section behavior and choices displayed is dependent on "Pattern".
-Pattern:Color scheme will be given in a separate reference later. Plan implementation of required behaviors for now.
-Remove "Re-review" button completely.
-Change "Save & Review Photos" text to "Save Observation".
\-_Currently_ "Save & Review Photos" sends users to photo screen -- assumed to be Annotation Box screen. Change wiring to send users back to "Submission Details" page
