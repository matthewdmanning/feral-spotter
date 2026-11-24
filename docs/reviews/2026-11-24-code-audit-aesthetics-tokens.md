# Code audit — aesthetics-tokens

Reviewed 2026-11-24 on `review/sonnet-code-audit` at `880c9b9`. Scope: `src/`,
`functions/src/`, `modules/*/src/` (JS only; the last two hold no UI). Lens ID
`STYLE`. `node_modules` is absent, so this is a static review: no test was run
and no pass/fail claim is made. Contrast ratios are WCAG 2.x relative-luminance
calculations on solid `themes.ts` values; glass is approximated as its tint
alpha-blended over `colors.background` (no ambient gradient), so glass ratios
are indicative only.

## Summary

- Token discipline in `*.styles.ts` is mostly good: no hex/rgb outside
  `themes.ts`, no numeric `fontSize`/`fontWeight`, no raw icon sizes in JSX, and
  every Text/TextInput goes through the capped shared components. The remaining
  gaps are specific, listed below.
- Biggest user-visible risk: the Switch (`ToggleRow`) draws its off track in
  `colors.border` (1.6–2.0:1) and its thumb in `colors.text`, which is 1.57:1
  against the on-track in dark mode (STYLE-1). The Date/Time trigger is a
  field-shaped control with no boundary (1.2:1 fill), unlike `TextField`
  (STYLE-6).
- App copy literals remain in components, hooks and route options in about 25
  places outside the copy owners, including sentence fragments
  (`PhotoDraftNotice`) and copy that narrates control behavior
  (`text.ts:269`, the burst-capture hint) (STYLE-3, STYLE-4).
- Disabled/pressed opacity is five unrelated raw literals (0.15, 0.5, 0.5, 0.7,
  0.7) with no theme token; `TextButton` disabled text falls to 2.2–3.5:1
  (STYLE-2).
- Counts: 0 P1, 7 P2 (STYLE-1 to STYLE-7; STYLE-7 is plausible, the rest
  confirmed), 3 P3 batches (STYLE-8 to STYLE-10); 2 test findings.
- Previous review (`2026-11-11-review-ui-ux.md`): F7 (input boundary) is fixed
  (`TextField.styles.ts:13`), SP3's `maxWidth: 640` is now
  `layout.contentMaxWidth`. SP1/SP2 copy centralisation covers only the areas
  that review named; the rest is re-reported here as new. The Home
  circle/`spacing.xxxl` tension is still open (see STYLE-9).

## Findings

### STYLE-1 — P2: Switch off-track and on-state thumb fail 3:1

**Where:** `src/shared/ui/molecules/ToggleRow.tsx:6-9` · **Basis:** source,
calculation · **Confidence:** confirmed
**Evidence:**
```tsx
const UniSwitch = withUnistyles(Switch, (theme) => ({
  trackColor: { false: theme.colors.border, true: theme.colors.accent },
  thumbColor: theme.colors.text,
}))
```
`colors.border` is the decorative hairline colour. Off track vs card glass:
1.67:1 light, 1.82:1 dark (vs `surface` 1.70 / 1.75). `border` is not an
essential-boundary token; `borderStrong` is (4.4–5.4:1, used for `TextField`,
`CheckboxBox`, `SegmentedControl`). The single thumb colour `text` against the
on track `accent` is 2.65:1 light, 1.57:1 dark (cream on moss), so in dark mode
the on-state thumb nearly disappears; the thumb is the only non-colour state
cue besides its position.
**Human path:** Home tabs → Settings (any signed-in or first-run path that shows
the tab) → Appearance/Photos card toggles ("Haptic Feedback", photo toggles) in
either theme. No network needed.
**Fix:** `trackColor.false = theme.colors.borderStrong`; give the thumb a
foreground that fits the track: `accentText` (6.5:1 on `accent`, both themes)
when on, `text` on the off track (10.1 / 7.3:1). `withUnistyles` maps theme
only, so read `useUnistyles()` in `ToggleRow` and pass `thumbColor` from `value`.

### STYLE-2 — P2: Disabled, busy and pressed opacity are unrelated raw literals

**Where:** `AppButton.styles.ts:85` (`0.7`), `TextButton.styles.ts:27` (`0.5`),
`core/home/screens/home/index.tsx:126` (`0.5` + grayscale),
`camera/index.styles.ts:130` (`0.5`),
`draft-submission/screens/create/index.styles.ts:61` (`catRowPressed: 0.7`),
`cats/index.styles.ts:28` (`0.15`) · **Basis:** source, calculation ·
**Confidence:** confirmed
**Evidence:** `theme.opacity` defines only `pressed: 0.7`, and `ReportCard.styles.ts:6`
uses it, but `create/index.styles.ts:61` repeats the literal. `AppButton`'s
comment says 0.5 "tanked label contrast", so it uses 0.7; `TextButton`, the same
role of "disabled action", still uses 0.5. Muted/accent/danger label at 0.5 over
card glass: 2.52 / 2.21 / 2.54:1 light, 3.50 / 3.09 / 3.52:1 dark.
**Human path:** Any disabled "Skip", "Clear", "Decline" style link (TextButton)
next to a disabled AppButton on the same screen; the two disabled looks differ
and the link is the less legible one. Draft Sighting → empty cat list → disabled
"Finished!" plus its reason.
**Fix:** add `opacity.disabled` (and `busy`) to `themes.ts` beside
`opacity.pressed`, pick one value that keeps text near 4.5:1 or switch disabled
to a colour change, and consume it in all six sites. `titleFaded: 0.15` is an
intentional hide-behind-bubble effect; give it a named token too.

### STYLE-3 — P2: App-owned copy literals remain in components, hooks and routes

**Where:** examples (not exhaustive) · **Basis:** source · **Confidence:**
confirmed
**Evidence:** standards require every screen title, heading, label, dialog,
validation message and accessibility label to come from `shared/config/text.ts`
or a feature `copy/` owner. Still inline:
- Screens/components: `ErrorBoundary.tsx:66,69,76,79`;
  `history/screens/feralReports/index.tsx:89,94,117-119`;
  `sightingDetail/index.tsx:58-60,95,97,106`; `draft-submission/screens/create/index.tsx:118,153,179,189,208,251-253,261,267-268,280`;
  `cats/index.tsx:107,111,133,138`; `permissions/screens/consent/index.tsx:35-37`;
  `CameraChrome.tsx:48-50,93,104,111,206`; `LegacyCameraScreen.tsx:23-29,83-84,121,125`;
  `DateTimePicker.tsx:31-36,49,125`; `CatForm.tsx:28-78`;
  `ProfilePicPicker.tsx:53,64,79,88`; `annotate/screens/annotate/index.tsx:69,77,172`;
  `location-picker/index.tsx:75-76`; `history/lib/history.ts:217-233`.
- Hooks (dialog copy): `useAnnotatePass.ts:144`, `useLibraryPhotoPicker.ts:61,87,104`,
  `useConsentPermissions.ts:64`, `useCatForm.ts:92`, `usePhotoStore.ts:206`,
  `useRemoveCat.ts:37`, `useAbandonCatGuard.ts:61`, `useDraftStartupStore.ts:68`.
- Sentence fragments / concatenation: `PhotoDraftNotice.tsx:21-32`
  (`used: 'camera'`, `blocked: 'Upload Photos'` spliced into a sentence),
  `useCatSubmit.ts:125` (`field${… !== 1 ? 's' : ''}`),
  `SightingsMap.tsx:177` (`spot${… ? '' : 's'}`), `CameraChrome.tsx:111`
  (`Flash ${flashMode}` shows the raw enum).
`feralReports/index.tsx` also renders the status enum (`{s}`) as a legend label.
**Human path:** every one is on a normal path: Sightings tab, Sighting detail,
draft Sighting, Cat form, camera, dialogs on remove/clear/limit.
**Fix:** extend the existing owners in place (`submissionCopy`, `navigationCopy`,
`commonCopy`, `settingsCopy`; history/camera strings join `text.ts` as new keys,
no parallel catalogue). Use named-placeholder templates with ICU-style plural
keys instead of `s`-suffix and noun-splicing.

### STYLE-4 — P2: Copy narrates how a control works

**Where:** `src/shared/config/text.ts:269`; `LegacyCameraScreen.tsx:128-132`;
`annotate/screens/annotate/index.tsx:69`; `text.ts:378,409,411` ·
**Basis:** source · **Confidence:** confirmed
**Evidence:**
`'… Anonymous is checked by default on each sighting and overrides name, email, and phone.'`
(`text.ts:269`) narrates a checked default and a control override, both named in
the standard as forbidden. `'Tap preview or shutter to start'` (burst hint) and
`showAlert('Remove photo', 'Long press to remove.')` narrate gestures;
`'… tap to set manually'` (a11y label) and `'… tap Submit Sighting to send it
again.'` narrate taps.
**Human path:** Settings → Organization sharing (with Organizations enabled)
shows `includedNotice`; Camera in legacy burst mode shows the hint; Annotate →
tap the trash button opens the long-press alert.
**Fix:** keep the service fact ("Cat count and an approximate area are always
shared") and drop the control sentence; fix the burst control label/grouping
instead of a hint; for errors say what happened and the status
("Sighting saved on this device. Not sent yet.").

### STYLE-5 — P2: Raw dimensions and strokes outside the theme config

**Where:** see list · **Basis:** source · **Confidence:** confirmed
**Evidence:**
- Stroke 1.5 repeated as a literal though `borderWidth.frame: 1.5` exists:
  `AppButton.styles.ts:31,37,44`, `CheckboxBox.styles.ts:8`,
  `CameraThumb.styles.ts:12`, `InsetCropBubble.tsx:78` (`BORDER_WIDTH`).
  Hairline `borderWidth: 1` instead of `borderWidth.control`:
  `GlassSurface.styles.ts:8`, `TextField.styles.ts:12`,
  `camera/index.styles.ts:15`, `location-picker/index.styles.ts:32`.
- Shutter: `camera/index.styles.ts:120-123,132-133` (`78`, `4`, `62`), plus
  `right: theme.spacing.xs + 2` (`:69`) and `CameraThumb.styles.ts:24`
  (`paddingVertical: 2`): off the 4pt grid.
- Local size constants: `CameraThumb.constants.ts:1-2` (64, gap **6**),
  `ProfilePicPicker.tsx:26` (`CROP_SIZE = 72`), `sightingDetail/index.tsx:37`
  (`CAT_PHOTO_SIZE = 96`), `InsetCropBubble.tsx:61-77` (68 twice, `48` =
  `controlHeight.touchTarget`), `TutorialOverlay.styles.ts:4-6`
  (`100`, `SKIP_BUTTON_HEIGHT = 48`). The same cat crop is 72 in the picker and
  96 on Sighting detail.
- `maxWidth: 360` three times: `dialogShell.styles.ts:23`,
  `ErrorBoundary.styles.ts:25`, `TutorialOverlay.styles.ts:31`.
- Tunable ratios in a component: `home/index.tsx:43-48` (`0.16`, `0.12`, `0.4`)
  while `theme.reticle` already owns the reticle.
The standard says tunable limits and ratios belong to a central owner and
photo/icon tokens must not stand in for control dimensions.
**Human path:** Camera (shutter), Cat form (profile crops), Annotate tutorial,
dialogs, Home; none depends on a gate beyond ordinary entry.
**Fix:** add narrow tokens to `themes.ts` (`controlHeight.shutter`, `shutter`
ring/core sizes, `layout.dialogMaxWidth`, `thumbnail` sizes, reticle ratios);
use `borderWidth.control/frame`; use `touchTarget` for the two 48s.

### STYLE-6 — P2: Date/Time trigger looks like an input but has no boundary

**Where:** `src/features/draft-submission/components/DateTimePicker.styles.ts:7-17`
(used at `create/index.tsx:162`) · **Basis:** source, calculation ·
**Confidence:** confirmed
**Evidence:**
```ts
trigger: { minHeight: control, …, backgroundColor: theme.colors.surfaceAlt,
  borderRadius: theme.radius.md, paddingHorizontal: lg, paddingVertical: md }
```
It copies `TextField`'s fill, radius, height and padding, but not its
`borderWidth`/`borderStrong`. `surfaceAlt` against the card glass it sits on:
1.20:1 light, 1.19:1 dark (against `background` 1.16 / 1.30). The F7 fix gave
`TextField` a 3:1+ edge (`TextField.styles.ts:12-13`); this same-role control was
missed. Label text inside is fine (14.1 / 11.1:1).
**Human path:** Draft Sighting → status card → manual time ("Location accuracy
… set manually" path) shows the pill without an edge in either theme.
**Fix:** reuse the `TextField` input style (border width token + `borderStrong`)
via one shared field-surface style so the two cannot drift.

### STYLE-7 — P2 (plausible): Active crop frame uses page foreground tokens over photos

**Where:** `annotate/components/AnnotateCarouselItem.styles.ts:8,17`,
`InsetCropBubble.styles.ts:28`, `annotate/screens/annotate/index.tsx:276` ·
**Basis:** source · **Confidence:** plausible (needs device)
**Evidence:** the active box stroke and crosshair are `theme.colors.text`
(`#211A13` in light mode, 1.5dp/1dp). Everything else drawn over live camera
content uses `onCamera*`, and `themes.ts` says cat colours "must read on any
photo". A near-black hairline over a dark photo region may vanish in light
mode, while dark mode gets cream. The dot and handle bars use `accent`, which
is dark olive `#5C6300` in light mode. The current-state doc does not name the
colours, so this is an open question, not a verdict.
**Human path:** Annotate with a night or shaded photo in light theme; draw the
first box and check the frame, crosshair and handles.
**Fix (if confirmed):** add `onPhoto`/`cropFrame.stroke` colour tokens that are
theme-independent (white with a dark halo), like `onCamera`.

### STYLE-8 — P3: Same-role text and surfaces differ between screens

**Basis:** source · **Confidence:** confirmed
- Screen titles: `sign-in/index.styles.ts:22` uses `display` (34/40), `register`
  `:15` uses `title` (28/36); every other screen title is `title`.
- Three stack-title configs: root `_layout.tsx:70-83` (`typography.lg` +
  `fonts.bold` in `headerTitleStyle`, the `heading` variant in `headerTitle`),
  `submission/_layout.tsx:65-80` (`heading` in both), Home `index.tsx:200-210`
  (`title` variant but `headerTitleStyle` says `typography.xl`/24 vs `title`'s
  28). `headerTitleStyle` is shadowed by the custom `headerTitle` renderer;
  see Handoffs.
- Reaction chips (`interactions/components/styles.ts:21`) use `body` (18/28)
  while every other selection option (`SegmentedControl.styles.ts`) uses
  `labelSmall`; their selected state is a fill change only.
- Cat-card gaps: draft list uses `stackGap` (12, `create/index.styles.ts:36`),
  Sighting detail (which says it "mirrors" it) uses `lg` 16
  (`sightingDetail/index.styles.ts:19`); card inner gap is 8 on detail/profile
  picker, 12 on Settings and organization cards.
**Fix:** one screen-title variant, one header config (see STYLE-9 to remove the
dead fields), one option typography role, one card inner gap.

### STYLE-9 — P3: Hand-built faces, wrong-role tokens and hairline variants

**Basis:** source · **Confidence:** confirmed
- `fontFamily: theme.fonts.*` overriding a variant (synthesised weight):
  `ReportCard.styles.ts:26`, `sightingDetail/index.styles.ts:26`,
  `CameraThumb.styles.ts:29`, `camera/index.styles.ts:71`,
  `ConsentChoiceScreen.styles.ts:40`, `DisclosureText.styles.ts:16`. Add a
  `captionBold`/`itemLabel` variant.
- Spacing tokens as component sizes: `legendDot` (`feralReports/index.styles.ts:45`),
  intro dots (`intro-flow/index.styles.ts:36-44`), annotate dots
  (`annotate/index.styles.ts:33`); `emptyIcon` is `iconSize.xl * 2`
  (`feralReports/index.styles.ts:35`) instead of `iconSize.hero` (64);
  `StatusIcon` default `size = 20` is `iconSize.md`.
- Inactive intro dot is `border` on `background`: 1.62:1 light, 1.98:1 dark
  (active dot is also a longer pill, so state is not colour-only).
- Hairlines: `settings/index.styles.ts:33` and `sign-in/index.styles.ts:47` use
  `height: 1`, `HierarchicalSegmentedControl.styles.ts:7` uses
  `hairlineWidth`.
- Home passes `spacing.xxxl` (32) to `computeEntrypointDiameter` (`home/index.tsx:175`)
  while the circles' actual gap is `spacing.md` (`index.styles.ts:15`); the
  design pattern says `xxl`. Still open from the previous review.

### STYLE-10 — P3: Glass and spacing details

**Basis:** source · **Confidence:** confirmed (visual effect unverified)
- `GlassSurface.styles.ts:8` adds `borderWidth: 1` only on the fallback path, so a
  card is 2dp narrower/shorter inside than the glass path; content shifts
  when Reduce Transparency toggles or Android glass errors. Use an inset
  shadow/ring that takes no layout space, or add the same transparent border to
  the glass branch.
- Screens with glass cards but no `AmbientBackground`:
  `organizations/membership/screens/MembershipsScreen.tsx`,
  `sharing/screens/SharedSightingsScreen.tsx`, `ErrorBoundary.tsx`. Glass over a
  flat fill looks like a plain card and differs from sibling screens.
- Per-heading `marginTop: theme.spacing.xs` inside gap-based hosts:
  `create/index.styles.ts:45`, `sightingDetail/index.styles.ts:35`,
  `annotate/index.styles.ts:34` (the host gap already separates sections).
- Stale comment `annotate/screens/annotate/index.tsx:73-75` says "36dp bordered
  box"; the style is a 48dp borderless `surfaceAlt` chip, so `hitSlop={6}` is
  redundant and the chip has a 1.2:1 fill against `background`.
- Home: `entrypointArea` spreads two circles with `space-evenly`
  (`home/index.styles.ts:12`); this is the documented pattern, noted only so a
  reader does not mistake it for filler.

## Test findings

### STYLE-T-1 — Coverage gap: no test exercises dark theme or semantic contrast

**Where:** `jest.setup.js:23-31`, `src/shared/ui/atoms/__tests__/*`,
`src/shared/config/__tests__/` · **Basis:** test-read · **Confidence:** confirmed
**Evidence:** the setup configures both themes through the library's
`react-native-unistyles/mocks` (correct), but no test switches to the dark theme
(`setTheme` is only spied in `themeMode.test.ts`), and no test checks a contrast
pair from `themes.ts`. The only resolved-style assertions are touch-target
minima and one `GlassSurface` fallback comparison against the light theme.
A change to `muted`, `borderStrong`, the Switch track token (STYLE-1) or the
disabled opacity would not fail anything.
**Fix:** one pure test that loads both themes and asserts the contrast pairs
the app relies on (text roles on `background`/`surface`/glass-over-background,
`accentText` on `accent`, control-boundary tokens vs fill, Switch track/thumb)
at 4.5:1 / 3:1. Add one component test for a themed control run under both
themes via `UnistylesRuntime.setTheme('dark')`.

### STYLE-T-2 — Coverage gap: no mechanical guard for raw values or copy

**Where:** `eslint.config.js`, `__tests__/architecture.test.ts` · **Basis:**
test-read · **Confidence:** confirmed
**Evidence:** the lint config has no color-literal, inline-style or raw-text
rule and `architecture.test.ts` checks import direction only, so the 14 sites
in STYLE-2 and STYLE-5 and the copy literals in STYLE-3 landed unnoticed.
Realistic mutation: adding `#fff` to a `*.styles.ts`.
**Fix:** enable `react-native/no-color-literals` and a no-literal-JSX-text rule
(or one `architecture.test.ts` case scanning `*.styles.ts` for hex/rgb); keep
it narrow so token files and tests are excluded. It cannot replace the rendered-
context copy review the standards require.

## Handoffs

- `review-navigation-ui`: `src/app/_layout.tsx:79-83`,
  `src/core/home/screens/home/index.tsx:204-208` — `headerTitleStyle` is set but
  the custom `headerTitle` renderer replaces the title Text, so the style
  fields appear dead (verify in React Navigation); `home/index.tsx:175`
  passes `spacing.xxxl` as the circle gap while the style uses `md`.
- `review-duplication`: `_layout.tsx:70-83` and `submission/_layout.tsx:65-80`
  repeat the same Stack header options; `maxWidth: 360` is copied into three
  style files (STYLE-5).
- `review-mvvm`: dialog copy is authored inside hooks (`useAnnotatePass`,
  `useLibraryPhotoPicker`, `usePhotoStore`, `useCatForm`, `useRemoveCat`,
  `useAbandonCatGuard`); the view-model/view split question belongs there, the
  copy-ownership rule is STYLE-3.
- `review-logic`: `useCatSubmit.ts:125` builds the unset-field list with ad-hoc
  pluralisation; `CameraChrome.tsx:111` surfaces a raw `flashMode` enum in an
  accessibility label.

## Not reviewed

- Native device rendering: glass over the ambient background, native tab bar,
  date pickers, map labels and real-photo contrast of the crop frame were not
  observed (`node_modules`, `adb` absent). All glass contrast ratios are
  indicative only.
- 2.0x font-scale behaviour at layout level (only the cap's presence in
  `Text`/`TextField` was verified).
- `src/shared/config/text.ts` was read for narration phrases, not line by line;
  `organizationCopy` templates were not each checked in rendered context.
- `attributes.ts` and `tutorial.ts` labels were treated as their feature's
  configured owners. Authoritative `ui-ux/current-state` docs for non-UI areas
  and `docs/adr/` were not needed for this lens.
- `functions/src/` and `modules/*/src/`: no UI, out of lens.
- Out of scope by policy: web, TTS/screen readers, external keyboards.
