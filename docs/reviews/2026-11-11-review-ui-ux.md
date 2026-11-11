# App UI/UX review

Reviewed 2026-11-11 on `review/ui-ux`, based on `origin/main` at
`fcdf2ec9dbf2777c519c2fcbb529af95e0e74441`.

This is a source-based review with calculated theme contrast. No application
behavior or authoritative design decision was changed. P1 means a core task or
accessibility requirement is at risk; P2 means a material usability or standards
gap. Layout consequences below are source-derived unless explicitly measured.

## Basis and coverage

Primary guide: [Project UI/UX standards](../agents/ui-ux-standards.md), including
placement, typography, the enforced 2.0× ceiling, spacing, contrast, glass,
configurable copy, human reachability and evidence requirements. Also reviewed
[layout guidance](../agents/ui-ux/reference/mobile-ux-layout-best-practices.md),
[principles](../agents/ui-ux/reference/ux_principles.md), general and situational
UX guidance, all current-state and decision-record UI documents, and the
annotation and draft-boundary ADRs. The newer project standard takes precedence
over the older reference's suggestion of selectively uncapped text.

| Views/elements inspected      | Scope and result                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Home                          | Entry circles, draft notice, resume actions, spacing; design conflict below                                               |
| Onboarding                    | Slide content, navigation, dots, safe areas; F3                                                                           |
| Consent and data agreement    | Scrollable disclosure, accept/decline and permission gate; shared issues F1/F7/F8                                         |
| Sign-in and Registration      | Inputs, provider buttons, loading, keyboard and short-screen layout; F2/F7/F8                                             |
| Email and analytics choices   | Checkbox, text, Continue, first-run gates; shared issues F1/F8; scrolling and explicit opt-in retained                    |
| Camera                        | Shared chrome, permission gate, thumbnails, shutter and solid surfaces; native framing/zoom unverified                    |
| Box Annotation and Tutorial   | Bottom controls, photo status dots, crop bubble, modal; F5; deliberate Back/swipe restrictions respected                  |
| Observed Cat / Edit Cat       | Attribute controls, grouped form, profile crop and actions; F4/F7                                                         |
| Sighting draft                | Status, cat accordion, empty state, pinned actions, organization placement; F9/F10                                        |
| Map picker                    | Pin, map viewport, footer and saved point; F6                                                                             |
| Sightings and Sighting detail | Virtualized history, map, status text/icons, empty/loading/not-found, cat details; shared F1/F8; native map unverified    |
| Settings                      | Appearance, communications, photo toggles, footer and organization sections; F2/F11                                       |
| Shared visual elements        | Buttons, text fields, segmented controls, checkbox, toggle, button rows, dialog shell, glass, typography and theme tokens |

## Findings

### F1 — P1: The required app-wide 2× scaling ceiling is not enforced

**Evidence:** `src/shared/ui/atoms/AppButton.tsx`, `TextField.tsx`,
`SegmentedControl.tsx`, `src/app/_layout.tsx`, and direct React Native Text use
throughout screens. Source inspection found no `maxFontSizeMultiplier`,
`allowFontScaling` policy, or shared capped text abstraction in `src`.
React Native defaults to an uncapped global maximum of 0 [R1]. The theme's font
sizes and line heights do not enforce a runtime ceiling.

**Human path:** Set system text size above 200%, then launch Onboarding or open
Settings, authentication, or a draft. These app-rendered labels and inputs inherit
platform scaling without the prescribed cap. No auth or network is needed for
first-run surfaces; signed-in screens require their ordinary entry gates.

**Recommendation:** Centralize the 2.0 limit for app-owned Text and TextInput,
apply it across shared controls and direct text, and inspect navigation and
third-party text separately. Preserve scaling below the ceiling. Validate at
normal, 2× and the largest OS setting; a cap alone does not fix F2–F5.

### F2 — P1: Authentication forms cannot scroll or avoid the keyboard

**Evidence:** Sign-in and register `screens/*/index.tsx` render only nested Views;
their `index.styles.ts` use `flex: 1` and `justifyContent: 'center'`. Neither has
a scroll container or keyboard-aware layout. Sign-in also includes the provider
button list. Settings has a ScrollView but omits `keyboardShouldPersistTaps`.

**Human path:** After Consent, open Sign-in → Create one; on a short Android
window at 2× text, focus Confirm password and attempt Create account. On Sign-in,
focus Password and reach the lower actions. Content has no scroll recovery when
it exceeds the reduced viewport. Separately, a signed-in user can open Settings,
type New email and tap Send verification link: ScrollView's documented default
`never` consumes the first tap to dismiss the keyboard [R3]. Offline users can
reach the same layouts; successful authentication/email delivery requires network.

**Recommendation:** Make both authentication forms scrollable and keyboard-aware,
and use handled keyboard taps for Settings' input actions. Check focused inputs,
validation dialogs and actions with the keyboard visible. Actual occlusion and OS
resize behavior remain unverified on device.

### F3 — P1: Onboarding has no overflow recovery at enlarged text

**Evidence:** `src/features/permissions/screens/intro-flow/index.tsx` places every
paragraph in `View style={styles.slideContent}` above a separate footer. The style
is `flex: 1, justifyContent: 'center'`; there is no ScrollView.

**Human path:** Fresh installation → progress through all slides on a short/narrow
phone at 2× text. Growing paragraphs compete with the pinned Previous/Next footer;
any excess text cannot be scrolled into view. No authentication, permission grant
or connectivity is required to read these slides.

**Recommendation:** Scroll the slide content within the available space, preserve
footer separation and verify every slide with long configured copy. Treat exact
clipping dimensions as a pending rendered-device check, not a measured result.

### F4 — P1: Segmented answers truncate essential choices instead of reflowing

**Evidence:** `src/shared/ui/atoms/SegmentedControl.tsx:41` defaults
`numberOfLines` to 1 and passes it to option Text. The styles keep all options in
one row with `flex: 1`, no wrap or width/font-scale adaptation, and only a 4dp gap.
Hierarchical choices permit two lines but use the same fixed row. React Native
explicitly documents that `numberOfLines` truncates [R1].

**Human path:** Signed-in user → take/select photos → Box Annotation → Observed
Cat; inspect longer attribute choices at 2× on a narrow phone. Settings → Theme
uses the same component. No organization rollout is required. Network is not
needed to interact with an already available draft/settings screen.

**Recommendation:** Reflow choices into readable rows or a stack using available
width and scaled content. Retain full labels and a consistent sizing contract;
meet the project's 8dp target separation rather than shortening/shrinking labels.

### F5 — P1: Annotation's essential action row bypasses adaptive stacking

**Evidence:** `src/features/annotate/screens/annotate/index.tsx` renders Previous,
Not in Photo and Done With This Cat directly in `styles.bottomBar`, which is
always a horizontal row. The middle button has intrinsic width; the others use
`flex1`. `AppButton.styles.ts` does not give its label a shrinking width.
The shared ButtonRow's font-scale stacking is bypassed.

**Human path:** Signed-in, consented user with at least one photo → start Box
Annotation → dismiss/complete Tutorial if shown → inspect the three actions at
2× on a narrow phone. The modal must be dismissed before testing these controls.
Offline annotation is reachable with locally available photos.

**Recommendation:** Give the group an adaptive layout and full wrapping labels;
verify the primary exit remains visible while preserving enough photo canvas for
boxing. Do not enable carousel swipe or hardware Back as a workaround: those
restrictions are intentional design decisions.

### F6 — P1: The map pin and the saved Submission location use different centers

**Evidence:** `src/features/draft-submission/screens/location-picker/index.styles.ts:8`
anchors the pin overlay to all four edges of the root, including the footer.
The map is a separate `flex: 1` sibling above that footer. Meanwhile
`index.tsx:38` saves `currentCenter()`, which `usePinCenter.ts` updates from map
camera-center events. Thus the visible pin tip lies below the map's actual center.
For root height H and footer height F with its 28dp negative top margin, the map
height is H − F + 28; the vertical center mismatch is (F − 28)/2, before any
native map padding. Text enlargement increases F and therefore the mismatch.

**Human path:** Signed-in user → draft with missing/low-accuracy location → tap
Location → drag a landmark under the visible pin → Set location. Permission and
map-service availability apply; the fallback remains distinct from editing a good
Live fix. The chosen location is derived from a point above the visible pin.

**Recommendation:** Put map and pin in the same bounded viewport, with the footer
outside it, or explicitly reconcile map padding and projection. Confirm a landmark
at default and 2× scale on a native map. The source geometry is established;
physical pixel/geographic error is not measured.

### F7 — P2: Text input boundaries fail the 3:1 contrast floor

**Evidence:** `src/shared/ui/atoms/TextField.styles.ts:12` uses `colors.border`
against `colors.surfaceAlt`. Calculated WCAG sRGB ratios from `themes.ts`:

| Appearance | Border  | Input fill | Ratio      |
| ---------- | ------- | ---------- | ---------- |
| Light      | #D7C3B0 | #F4E6DA    | 1.394028:1 |
| Dark       | #524436 | #302921    | 1.528445:1 |

Both fail 3:1 [R5]. These are solid input colors, so native glass compositing is
not needed to establish this internal edge/fill failure. As a useful baseline,
normal text on the opaque surface is 17.187364:1 light and 12.726417:1 dark;
that does not establish contrast on gradients or glass.

**Human path:** Open Sign-in, Registration or Settings → New email in either
theme. Inputs have the low-contrast boundary before interaction, independent of
network. Authentication is needed only for Settings.

**Recommendation:** Use the semantic strong control-boundary token (after
checking both adjacent colors) and define a discernible focused state. Measure
actual backdrop/gradient combinations separately.

### F8 — P2: Visual headings mostly lack heading semantics

**Evidence:** Settings title/card headings, Sighting section headings, disclosure
titles and `src/shared/ui/organisms/DialogShell.tsx` title are plain Text without
heading semantics. Only Onboarding declares `accessibilityRole="header"` in the
inspected app sources.

**Human path:** Open Settings or a normal app dialog and navigate by headings in
TalkBack/VoiceOver. These visually emphasized Text nodes have no explicit heading
role, making the visual hierarchy unavailable through heading navigation. Dialogs
can be reached before sign-in through validation/consent; Settings requires sign-in.

**Recommendation:** Mark true screen/section/dialog headings with the supported
accessibility role, preserving ordinary labels as labels. Verify actual focus and
heading navigation with assistive technology. This is a source semantic gap, not
a recorded screen-reader session [R4].

### F9 — P2: Location correction has a label-sized target below 48dp

**Evidence:** Draft `screens/create/index.styles.ts:28` gives the Location
Pressable only flex-row alignment and gap, with no target minimum, padding or
hitSlop. Its icon is 20dp and default label line height is 20dp. Card padding is
outside the Pressable and does not enlarge its hit area [R2]. A multiline sibling
can stretch the row, but the minimum target is still not guaranteed.

**Human path:** Reach the draft list with missing/low-accuracy location and a
recorded time, then tap Location to correct it. The warning state enables the
Pressable; an acquired Live fix deliberately disables it. This is a default-scale
problem even without organization sharing or network.

**Recommendation:** Enforce at least a 48dp target on the control itself; retain
clear label/icon status and separation from the time control. Verify native bounds.

### F10 — P2: Sighting-level sharing is buried after the cat list

**Evidence:** `src/features/draft-submission/screens/create/index.tsx` renders
`SubmissionOrganizations` after the entire cat list and its Add a Cat action.
Project placement standards require sighting-level information and permissions
beside the sighting summary, rather than after a growing list of cats.

**Human path:** Authenticated user with the Organizations rollout enabled and a
hydrated account → create a normal multi-cat draft → scroll past every cat and
Add a Cat to find sharing/confirmation. No artificial admission-limit fixture is
required to establish the ordering. Directory choices depend on location and
live/cached coverage; no claim is made that the rollout is enabled for all users.

**Recommendation:** Group this sighting-level section near location/time and the
sighting summary; preserve its loading, cached/offline, empty and retry distinctions.

### F11 — P2: Settings mixes independently saved controls under a global footer

**Evidence:** Settings has instant appearance/haptics/email choices, separately
saved sharing preferences, draft photo/developer toggles, and a global Save /
Discard footer. `useSettingsDraft.ts` only persists/discards AppSettings. The
sharing form also places all field checkboxes before conditional Name/Phone
inputs, rather than immediately under the revealing choice. Its shared card style
uses screen-title typography, local vertical margins and no card-radius token,
unlike adjacent Settings cards.

**Human path:** Signed-in user → Settings → change appearance/email, then change a
photo toggle → Discard. Only draft settings revert; earlier changes remain. With
Organizations enabled/hydrated, sharing adds another save scope and visually
different cards. Reachability does not require inventing a Settings route from a
modal or enabling a hidden control; the tab itself is an entry point.

**Recommendation:** Put actions with the settings they own; make save scopes clear
through grouping and placement. Keep instant email behavior as required by the
email-opt-in decision. Move dependent inputs next to their choices and reuse
section typography, host spacing and card radius. Avoid adding explanatory
Save/Discard helper paragraphs to compensate for the structure.

## Product/design tensions to resolve

- The authoritative Home pattern calls for circles side by side. Home renders
  them vertically in portrait (`flexDirection: isLandscape ? 'row' : 'column'`).
  It also passes `spacing.xxxl` (32) to diameter calculation, while the pattern
  specifies `spacing.xxl` (24). Record this as a mismatch for product review;
  do not silently overwrite the design record or assume implementation is wrong.
- The empty-cat decision gives Annotate Photos primary emphasis. The current
  empty state offers both Annotate Photos and Describe a Cat as secondary buttons.
  Both paths remain available; the visual priority differs from the decision.
- The first-run-order decision omits email-opt-in, while the newer email-opt-in
  current-state document explicitly places it before analytics. Review follows
  the more specific current-state requirement; do not remove that step.

## Verification and limits

- **Source inspection:** Views/composition/styles and relevant gates inspected as
  listed above. This does not establish exact clipping, touch bounds or visual polish.
- **Contrast calculations:** Used WCAG relative luminance and
  `(Llighter + 0.05) / (Ldarker + 0.05)` on solid theme pairs. No rounded fail was
  treated as a pass. Native glass, gradients and over-photo contrast are unmeasured.
- **Official docs:** Retrieved and read R1–R5 on 2026-11-11. The Expo keyboard guide
  returned HTTP 403, so no claim relies on having read that page successfully.
- **Browser attempt:** Started Expo web on port 8090 and attempted headless Chromium
  plus a direct bundle request. Metro returned HTTP 500: unable to resolve
  `react-native-web/dist/index` from Expo Router. `react-native-web` is absent from
  the project's dependencies. No usable app browser render or screenshot resulted.
  Existing dependencies were temporarily linked from the original checkout; no
  dependency manifests were changed. A web port would not validate native camera,
  maps, glass, or OS permission surfaces.
- **Native attempt/capability:** `adb` was absent from PATH; no Android emulator or
  attached-device tooling was found in the inspected runtime locations. Native
  execution was therefore unavailable in this environment.
- **Tests:** No application changes or tests added/run for this documentation-only
  review. No fixture injection was treated as proof of a human journey.
- **Still required:** Native Android narrow/short phone and 600dp+ window; default,
  2× and maximum platform font/display size; both themes; keyboard-open forms;
  TalkBack/VoiceOver; reduced transparency/high contrast; real glass over ambient
  backgrounds; camera/annotation framing; permission denial, offline retry and
  destructive confirmations. These are pending, not passing checks.

Recommended order: correct F6's location geometry, enforce the shared text policy,
then address authentication/onboarding overflow and segmented/annotation actions.
Follow with contrast, target/heading semantics and screen grouping, then run the
native matrix. Fixes should include focused regression coverage for actual failures
and device evidence for geometry/visual behavior.

## Official references

- **R1:** [React Native Text](https://reactnative.dev/docs/text) — scaling defaults,
  truncation and `numberOfLines`.
- **R2:** [React Native Pressable](https://reactnative.dev/docs/pressable) — hitSlop
  and parent-bound limits.
- **R3:** [React Native ScrollView](https://reactnative.dev/docs/scrollview) — keyboard
  tap handling and its default.
- **R4:** [Android accessible apps](https://developer.android.com/guide/topics/ui/accessibility/apps)
  — 48dp touch targets, describing elements and heading semantics.
- **R5:** [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
  — 3:1 meaningful control/state visuals and inactive-control exceptions.
