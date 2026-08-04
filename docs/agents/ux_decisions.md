# UX Guidelines — Situational Patterns

## Editing rules

Entries here are tied to a specific interaction or component. Include concrete file names and method/class/variable names — that's what makes this file useful as a "what already exists" reference before inventing a new pattern. Do not include line numbers; they go stale.

Rules that apply broadly, independent of any specific interaction or component, belong in [ux_guidelines_general.md](ux_guidelines_general.md) instead.

This is a living document. Extend it, don't replace it.

## Gestures

Gesture thresholds (velocity, distance) start from industry-standard values, defined as named constants in `src/config/*.ts` (see `src/config/location.ts`, `src/config/tutorial.ts`) — never hardcoded inline, never a user-facing setting.

**Swipe-to-dismiss**: an upward swipe on a photo unassigns it from the current cat only (soft dismiss — pool and other cats' assignments untouched), distinct from the destructive long-press Remove (`useAnnotateStateMachine.ts`'s `handleLongPressRemove`, which deletes the photo from the whole submission). Pair every dismiss with the Undo bubble.

**Gesture composition**: when a new gesture lands on a surface that already owns a conflicting one (e.g. `AnnotateCarouselItem.tsx`'s `photoGesture` owns pan/pinch/double-tap for bounding-box framing), gate it with `Gesture.Race(existingGesture, newGesture)` so it only arms when the existing gesture isn't mid-pan/mid-pinch. Don't carve out a separate dead zone unless explicitly asked.

## Undo bubble

Transient, dismissible confirmation shown after a soft/reversible destructive action (e.g. swipe-to-dismiss), positioned ~1/5 of the screen height from the top. Distinct from `Alert.alert` confirmations — the bubble appears after the action (optimistic/reversible); `Alert.alert` gates before an action that can't be undone.

## Confirmations & destructive actions

Existing pattern (`useCatSubmit.ts`'s `handleReset`, `useAnnotateStateMachine.ts`'s `handleLongPressRemove`): irreversible actions go through `Alert.alert` with `{ text: 'Cancel', style: 'cancel' }` first and the destructive option styled `style: 'destructive'`. Where confirmation would repeat needlessly, offer a "Remove, don't ask again" option that persists a `skip_*_confirm` flag to `useSettingsStore` (see `skip_photo_remove_confirm`) — never skip by default, only after opt-out.

## Status / warning indicators

Inline status pairs icon + label, not a modal: `AlertCircle` (warning color) when a value needs attention, `CheckCircle` (success color) when resolved, each with an `accessibilityLabel` describing state and available action (see `create/index.tsx`'s location/time status row). Tapping the icon is only enabled while the warning state is active.
