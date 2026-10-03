# Bug Hunt

**Purpose**: Look for evidence and root cause of GitHub Issues tagged as _bug_.

## Intro Flow

- [MVP]: Refers to login with Google but uses multiple auth methods.
- [MVP]: Review copy vs actual shared info.
- [Beta]: Link to project's website.
- [Beta]: Add 'How Your Data Will Be Shared'
- [Closed]: Selecting "Only This Time" still allows access. Desired behavior.

## Home

- [UI Design]: Buttons should be large icons -- approx half screen height with about 30 px spacing.

## Annotate

- [UX]: Direct transition Camera -> Annotate screen [Confirmed]
- [Alpha]: Transition to Annotate screen is too rapid. Tutorial may slow this down.
- [Bug]: Bubble is still at lower-right instead of upper-right.
- [Bug]: Bubble starts maximized. It should load minimized.
- [Bug]: Bubble is off-screen when minimized. Purpose of Bubble is not intuitive to the User.
- [Bug]: User can navigate to Camera with Back gesture.
- [Bug]: `Not in Photo` button is still not enabled for first photo.
- [UI]: `Boxing Complete` label should have centered text.
- [UI]: `Back` button label change to `Previous`. Less chance of being interpreted as going back to Camera/Library screen.
- [UI]: Photo can be moved without restraint, even completely off-screen. Edge should not be able to cross the center point.
- [Feature]: Gesture up does not trigger `Not in Photo` action. Configurable velocity needs lowering.
- [Closed]: Previously drawn Bounding Box is retained when navigating `Back`.

## Cat Form

- [Bug]: Bubble starts maximized.
- [Bug]: Header does not collapse with Bubble.
- [Bug]: Bubble is not visible after collapse.
- [Bug]: `Unknown`/`Unsure` labels load by default. No buttons should be selected if this cat is not filled out.
- [Bug]: Buttons can be selected, but field cannot be clear. Tapping selected button should deselect it.
- [UI]: Format missing field names as a list. Remove "-- Save anyway?". Already present in `Save Anyway` button.
- [Bug]: Submit button navigates back to Camera screen. It should navigate to Cat List screen.
- [Closed]: Camera -> Cat List correctly if catList > 0.
- [Closed]: Tapping `! Location` navigates to Maps. GPS location is accurate.
- [Closed]: Submit navigated back to home screen.
