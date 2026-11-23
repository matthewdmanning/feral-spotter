# App-owned dialogs: every confirmation follows the theme

**Scope:** feat + refactor
**Issues/spec:** #337 (a sub-issue of #320). Resolves #328's cluster 2 and settles the three modal-shaped components #328 named.
**Date:** 2026-08-27
**Branch/PR:** `issue-320-ui-styling-pass` — `6503c56`, `a36838a`, `acca797`

## Scope

**In scope:**

- [x] One themed dialog the app draws itself, replacing the OS alert
- [x] All 22 non-test `Alert.alert` call sites converted
- [x] The centred-dialog shell extracted and shared (#328 cluster 2)
- [x] Three unmounted components deleted

**Out of scope:**

- **OS permission prompts.** The system draws them; they cannot be themed. Unfixable, not deferred.
- **The Google Map rendering dark inside a Light app** — same root cause, different fix. #327.
- **System mode not tracking the OS live** — filed as #338.
- Any device pass. #337 carries `needs-verification` for exactly this reason.

## Intent

**Purpose:** The 2026-08-26 device drive found that a third of the app's confirmations ignore the theme. `Alert.alert` renders the _OS_ dialog, which follows the OS appearance rather than the app's, so Clear Draft, validation, and the abandon-cat guard all render dark-grey while the app is in Light. The drive's verdict: no theme sweep can pass while that is true.

## The shape of the fix, and why

`showAlert(title, message?, buttons?)` keeps `Alert.alert`'s exact signature, including the `{text, style, onPress}` button shape.

That was the whole design decision. Most of the call sites live inside hooks and plain functions — not components — so a `useDialog()` hook would have forced all 22 to be restructured around React's rules. An imperative function that writes to a store is callable from precisely where `Alert.alert` already was, which is what made the conversion mechanical.

State lives in `useUIStore`, which already owned `showError`/`showSuccess`; both now route through `showAlert`, so their own call sites were untouched. It is excluded from persistence via `partialize` — a rehydrated dialog would pop a stale confirmation on cold start, with handlers whose closures died with the last process.

`AlertHost` is mounted once in `AppProviders`, above every screen, and is the only place that knows what a dialog looks like. Two behaviours the native alert gave for free and that are now ours to keep:

- It dismisses _before_ running a handler, so a handler that raises the next dialog (the submit flow chains two) isn't wiped by its own dismiss.
- Android's back button runs the `cancel` button's handler if there is one, and otherwise just closes — matching the native behaviour.

Two buttons sit side by side as the native alert does; three or more stack, because side-by-side would push each under the 48dp floor #325 established.

## #328's three modal-shaped components

#328 asked whether `ValidationSheet`, `AddAnotherCatDialog`, and `PhotoPreviewModal` were one overlay primitive wearing three hats. The answer was a third option: **all three had zero importers.** Nothing to consolidate, because nothing was mounted. Each had a live replacement already — `showError`'s dialog (#265), the persistent "Add a Cat" button (#299), and the annotate screen respectively.

That _unblocked_ cluster 2 rather than dissolving it. The `backdrop`/`sheet` pair was byte-identical between `AddAnotherCatDialog` (dead) and `DateTimePicker` (live), so extracting it would have served one real caller — which #328's own rule rejects. `AlertHost` makes two, so `dialogShell.styles.ts` is a real consolidation. Values are DateTimePicker's originals, so it renders unchanged.

`5583ab3` themed `ValidationSheet` for the light theme and part of `8d98b85` routed `AddAnotherCatDialog`'s buttons through `AppButton`. Both were work on code no user could reach. They stay in history; the deletion supersedes them forward.

## Tests

The suites that asserted on `Alert.alert` moved seam rather than losing coverage: they spied on it and read its third argument for the buttons, and now spy on `showAlert` and read the same argument. Same assertions, against the app's own function instead of a mocked native module.

`AlertHost` has its own suite covering the two inherited behaviours above plus the `OK` default.

One consequence worth knowing: every screen that raises a dialog now pulls `useUIStore`, and therefore the storage layer, in transitively. AsyncStorage and MMKV are mocked globally in `jest.setup.js` instead of in each suite that trips over it.

57 suites / 261 tests green; `tsc --noEmit` clean; no new lint findings.

## Known gap

Not run on a device. The defect this fixes is invisible to CI by construction — the same class that hid `ValidationSheet`'s unreadable error cards. #337 stays `needs-verification` until one dialog of each shape (confirm, destructive, error, success) has been seen in both Light and Dark, and #329's sweep is now blocked by it.

## 2026-11-02 — fix (accessibility pass)

**Purpose:** Codebase review: dialogs and the tutorial card clipped at the largest font size, and several controls misreported themselves to screen readers.
**Change:**

- `dialogShell.sheet` caps at 90% height; AlertHost content scrolls. Button keys include the index.
- TutorialOverlay: card scrolls and starts below Skip; reopening starts at step 1; index clamps to the steps array.
- DateTimePicker trigger announces its value; each open starts from the current value at the first step.
- AppButton reports `busy` while loading. CameraThumb is an `image` named "Photo N of M" and resets after a refused swipe-discard. CatCrop resets on a new `uri`. ButtonRow uses the children's own keys. PhotoDraftNotice actions wrap.
- SightingsMap: memoized Android markers and UI settings, a map label, touch state released on unmount.
- InsetCropBubble expanded size floors at 48dp.
- Cleanup: StatusIcon's empty stylesheet became `StatusIcon.constants.ts`; HierarchicalSegmentedControl's commented label removed; ReportCard braces.
  Test: `TutorialOverlay.reopen.test.tsx` (both cases fail on the old code). iOS-only paths (date step toggle, Apple map markers) not changed. Not checked on device.

## 2026-11-03 — refactor (dialog shell, bubble props)

**Purpose:** AlertHost and DateTimePickerButton each hand-built the same Modal, backdrop, sheet, title and #342 theme subscription; InsetCropBubble carried props no screen used.
**Change:** `organisms/DialogShell.tsx` (title, onRequestClose, children) owns the Modal, the scrolling sheet and the theme subscription; both dialogs render inside it. TutorialOverlay keeps its own bottom-anchored layout. InsetCropBubble drops `onDiameterChange`, `onCollapsedChange` and `draggable` (always on) and exports `BUBBLE_HEADER_RESERVE` for Cat Form's header instead of `COLLAPSED_DIAMETER`. No visual change intended; not checked on device.

## 2026-11-08 — fix (async dialog completion types)

**Purpose:** Restore the explicit completion contract for async dialog actions from `1a468a7`.

**Change:** `AlertButton.onPress` and `pressDialogButton` return `void | Promise<void>`, allowing the existing dialog helper and Submission tests to await completion without Promise casts. Runtime dismissal order is unchanged.
