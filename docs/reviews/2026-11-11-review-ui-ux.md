# App UI/UX review

Reviewed 2026-11-11 on `review/ui-ux`, based on `origin/main` at
`fcdf2ec9dbf2777c519c2fcbb529af95e0e74441`.

The initial findings below describe the source-based review with calculated
theme contrast. Subsequent code changes are recorded in the implementation
status below; authoritative design decisions have not been changed. P1 means a core task or
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
| Consent and data agreement    | Scrollable disclosure, accept/decline and permission gate; shared issues F1/F7                                            |
| Sign-in and Registration      | Inputs, provider buttons, loading, keyboard and short-screen layout; F2/F7                                                |
| Email and analytics choices   | Checkbox, text, Continue, first-run gates; shared issues F1; scrolling and explicit opt-in retained                       |
| Camera                        | Shared chrome, permission gate, thumbnails, shutter and solid surfaces; native framing/zoom unverified                    |
| Box Annotation and Tutorial   | Bottom controls, photo status dots, crop bubble, modal; F5; deliberate Back/swipe restrictions respected                  |
| Observed Cat / Edit Cat       | Attribute controls, grouped form, profile crop and actions; F4/F7                                                         |
| Sighting draft                | Status, cat accordion, empty state, pinned actions, organization placement; F9/F10                                        |
| Map picker                    | Pin, map viewport, footer and saved point; F6                                                                             |
| Sightings and Sighting detail | Virtualized history, map, status text/icons, empty/loading/not-found, cat details; shared F1; native map unverified       |
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

### F2 — P1: Authentication forms cannot scroll or avoid the on-screen keyboard

**Scope:** This finding concerns the mobile on-screen keyboard and touch actions.
External keyboard navigation, focus traversal, shortcuts and keyboard-only use
are unsupported and excluded; they are not pending checks.

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

### F8 — Excluded: screen-reader heading navigation

Removed from actionable findings following the user's product-scope clarification.
Very-low-vision/nonvisual features, including TTS and screen-reader navigation,
are excluded from reviews, checks, tests and implementations. Existing heading
semantics do not require removal. Finding identifiers are retained for traceability.

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
- **Historical browser attempt (outside supported scope):** Started Expo web on port 8090 and attempted headless Chromium
  plus a direct bundle request. Metro returned HTTP 500: unable to resolve
  `react-native-web/dist/index` from Expo Router. `react-native-web` is absent from
  the project's dependencies. No usable app browser render or screenshot resulted.
  Existing dependencies were temporarily linked from the original checkout; no
  dependency manifests were changed. A web port would not validate native camera,
  maps, glass, or OS permission surfaces. Following the scope clarification, web
  support is not a defect or a pending validation requirement.
- **Native attempt/capability:** `adb` was absent from PATH; no Android emulator or
  attached-device tooling was found in the inspected runtime locations. Native
  execution was therefore unavailable in this environment.
- **Tests:** No application changes or tests added/run for this documentation-only
  review. No fixture injection was treated as proof of a human journey.
- **Still required:** Native Android narrow/short phone and 600dp+ window; default,
  2× and maximum platform font/display size; both themes; forms with the on-screen keyboard open;
  reduced transparency/high contrast; real glass over ambient
  backgrounds; camera/annotation framing; permission denial, offline retry and
  destructive confirmations. These are pending, not passing checks.

Recommended order: correct F6's location geometry, enforce the shared text policy,
then address authentication/onboarding overflow and segmented/annotation actions.
Follow with contrast, touch targets and screen grouping, then run the
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
  — 48dp touch targets.
- **R5:** [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
  — 3:1 meaningful control/state visuals and inactive-control exceptions.

## Product-scope clarification — 2026-11-11

Applied the user's scope clarification: native mobile field work only; web is
unsupported, and very-low-vision/nonvisual features such as TTS and screen readers
are excluded from reviews, checks, tests and implementations. Ten actionable
findings remain; F8 is excluded. Historical browser-attempt evidence is retained
only as a record of what was attempted, not as a requirement to add web support.
Visual readability, scaling, contrast and touch usability remain in scope.

### Separate keyboard scope

Separate hardware/external keyboard use is unsupported and excluded from this
review and from checks, tests and implementations. No external-keyboard support
is requested by the findings. F2 remains actionable because it concerns the
mobile on-screen keyboard used to enter account details, rather than a separate
keyboard. Native validation should use touch input and the on-screen keyboard.

## Implementation status — 2026-11-11

Implemented on `review/ui-ux` after the user's request to fix the remaining
recommendations. The findings above preserve the reviewed baseline.

| Finding | Implemented change                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1      | Central 2.0 multiplier, forced-on scaling through shared Text/TextField; all app-owned Text migrated, including nested and stack-title text      |
| F2      | Scrollable keyboard-avoiding account forms; Settings handles touch actions with the on-screen keyboard open                                      |
| F3      | Onboarding slide content scrolls independently of the action footer                                                                              |
| F4      | Choice tracks wrap with scalable minimum widths, complete labels and 8dp gaps                                                                    |
| F5      | Annotation uses the adaptive ButtonRow within a bounded scrolling action region                                                                  |
| F6      | Pin and map share one viewport excluding the footer                                                                                              |
| F7      | Strong input boundaries and an accent focus boundary                                                                                             |
| F8      | Excluded by product scope; no screen-reader work implemented                                                                                     |
| F9      | Location correction control has a 48dp minimum height                                                                                            |
| F10     | Sighting sharing follows location/time and precedes the cat list                                                                                 |
| F11     | Photo Save/Discard is local to the photo group; sharing fields follow their choices; organization cards share radius/heading/spacing conventions |

The new solid input-border/fill contrast ratios are **3.683614:1 light** and
**4.529205:1 dark**. Focus accent/fill ratios are **5.302100:1 light** and
**7.072999:1 dark**. Native compositing and focus appearance still need a device.

Verification: the full JavaScript suite passed with **119 suites / 531 tests**.
Application, server and test TypeScript checks passed. Changed-file ESLint passed.
Formatting and whitespace checks passed. A final focused Settings regression was
rerun after limiting persistence to edited settings, to avoid overwriting an
independent setting while the tab remains mounted.

New tests exercise text/input policy overrides, selection with complete labels
at font scales 1/2/3, Settings persistence boundaries and shared map/pin containment.
They establish renderer/interaction contracts; they do not measure native layout.

**Remaining validation limitation:** No native run was possible (`adb` absent).
Narrow/short-screen layout, on-screen keyboard behavior, actual native map pin
alignment, glass and both-theme appearance remain unverified. Native tabs, map
labels and OS date pickers are platform-owned UI rather than React Native Text;
their SDKs do not expose its `maxFontSizeMultiplier`. Their actual scaling must
be checked on device; no test here proves a 2× ceiling for those native controls.
The app-owned text ceiling is enforced in code, not merely documented.

The Home circle placement/gap, empty-cat visual-priority and first-run-document
mismatches remain the product/design tensions recorded above. No authoritative
design files were silently changed. Web, external keyboards, TTS and
screen-reader features remain excluded.

Feature-specific implementation entries:
[shared layouts](../implementations/2026-10-28-ui-component-spacing-alignment.md),
[text/theme](../implementations/2026-08-26-issue-320-theme-mode-and-breakpoints.md),
[sharing](../implementations/2026-11-07-feat-organizations.md),
[Onboarding](../implementations/2026-08-09-intro-flow-t1-hardware-back.md),
[location](../implementations/2026-08-09-consent-66-location-permission-gate.md).

## Second pass — copy/config ownership and regression review

The user requested a second pass after the implementation and added a stricter
rule: all copy and scaling must use project tokens or centralized configuration,
reusing the existing owner rather than duplicating files. The
[project standards](../agents/ui-ux-standards.md) now state that rule explicitly.
This pass reviews implementation commit `7f18efc`; findings from the initial
baseline above remain historical.

Three read-only subagents ran with the low-cost `gpt-6-luna` model at high
reasoning effort, with separate tasks:

- Copy audit: authored strings/templates and duplicated ownership, with existing
  configuration owners identified for remediation.
- Scaling audit: ceiling enforcement, adaptive dimensions/thresholds, shared
  tokens and remaining runtime bypasses.
- Layout audit: regressions in authentication, Onboarding, annotation, Map picker,
  Settings/sharing, and whether tests establish the claimed behavior.

The primary agent consolidates and checks the findings below. No separate audit
files or duplicate configuration files are created. Source findings, renderer
contracts and native-device evidence remain distinct. This review excludes web,
external keyboards, TTS and screen-reader/nonvisual features; mobile on-screen
keyboard and visual usability remain in scope.

### Consolidated findings

**SP1 — P2: Settings copy is only partially centralized.**
`src/features/settings/copy/settingsCopy.ts:2` owns the photo Save/Discard copy,
but `src/features/settings/screens/settings/index.tsx:37` still defines Theme
labels locally, and `index.tsx:73` onward embeds Settings, Appearance, Haptic
Feedback, Communications, account-email and Data Policy copy. This is a policy
gap, not a newly observed behavioral regression: the extraction in `7f18efc`
covered only the changed photo section. Human path: signed-in user → Settings;
photo/developer options additionally depend on their build/platform gates.
Extend the existing `settingsCopy.ts`; retain toggle labels/descriptions in their
existing `config/photoToggles.ts` owner and import the canonical values. Do not
create a second Settings copy file. Identical words such as Cancel are not, by
themselves, proof that a duplicate canonical file exists.

**SP2 — P2: Material sharing copy and other feature templates remain authored
inside UI/logic.** `src/features/organizations/components/SharingSettings.tsx:55`
and `SubmissionOrganizations.tsx:83` embed sharing facts and choice labels;
`OrganizationPermissions.tsx:22` embeds the permission-review sentence template.
`SharingSettings.tsx:68` constructs a label by lowercasing a field noun, despite
the complete-label rule. Human path: authenticated account with Organizations
enabled and hydrated → Settings preferences or a located draft → select an
eligible organization → confirm sharing. Cached coverage can support offline
choices; permission re-review requires current coverage. These predate `7f18efc`;
that commit relocated fields without centralizing their copy.

The same policy backlog exists in authentication (`sign-in/index.tsx:27`,
`register/index.tsx:25`, `auth/hooks/useChangeEmail.ts:15`) and submission dialogs
(`draft-submission/hooks/useSubmissionSubmit.ts:52`). Signed-out users can reach
authentication validation; authenticated users with local draft content can reach
submission confirmation, with network needed for successful service operations.
Use complete configured templates, preserving inserted values and locale-aware
formatting. Reuse existing owners such as organization `lib/sharing.ts`'s
`FIELD_LABELS`/summary vocabulary, auth `lib/authProviders.ts`'s provider labels,
and shared `utils/validation.ts`'s validation messages. These are existing
vocabulary owners, not evidence that a complete copy configuration already exists
for every feature. Establish one canonical ownership boundary for any uncovered
copy before migrating consumers; do not scatter or duplicate catalogs, move
feature-specific copy into an unrelated feature, or create dependency cycles.
Permission copy already has canonical JSON files and should continue using them.

**SP3 — P2: Adaptive sizing still has local, duplicated configuration.**
`auth/screens/sign-in/index.styles.ts:18` and
`auth/screens/register/index.styles.ts:11` each add `maxWidth: 640` in `7f18efc`;
Settings already has a local 640dp width rule. These are authored sizing limits,
not device measurements. Human path: Sign-in/Create account on a wide native
window, or signed-in Settings; no organization rollout is required. Reuse a
semantic content-width token in `shared/config/themes.ts` rather than preserving
three independent literals. The segmented track's `borderWidth: 1`
(`shared/ui/atoms/SegmentedControl.styles.ts:20`) and matching subtraction of 2
in `SegmentedControl.tsx:52` are also coupled without a shared dimension owner.
A semantic track-border token should drive both; the count of two sides itself
is a structural fact and does not need a new token.

The primary agent applies the user's **all scaling** requirement to interaction
transforms as well as text/reflow. The existing pressed `scale: 0.97` in
`shared/ui/atoms/AppButton.styles.ts:90` is therefore configuration backlog,
even though it is not a layout regression. Likewise the new annotation action
`maxHeight: '50%'` in `annotate/screens/annotate/index.styles.ts:38` encodes a
tunable action/canvas budget. Give these narrowly named roles in the existing
theme/config owner. This is distinct from structural fill values such as 100%,
platform insets, a count of sides or runtime measurements. These ownership follow-ups do not establish measured overflow or a behavioral
regression.

**SP4 — P2: The new width-triggered action reflow lacks regression coverage.**
`shared/ui/molecules/ButtonRow.tsx:29` now chooses a stack from measured width as
well as font scale. `ButtonRow.test.tsx:12` fixes width at 400 and only varies font
scale; no test exercises a measured-width change. Annotation's screen tests cover
button wiring rather than its three-action group within the bounded scroller.
Human path: signed-in, consented user with local photos → Box Annotation →
complete/dismiss Tutorial → narrow/short native window at default or 2× text.
Add focused coverage for narrow-to-wide `onLayout` changes with real controls and
unchanged action callbacks. Separately validate by touch that Done With This Cat
is reachable by scrolling and the photo canvas remains usable on a short phone.
This is a concrete missing regression guard and an unverified native layout risk,
not proof that the action currently clips. Extend the existing ButtonRow and
annotation test files rather than adding parallel copies of their coverage.

### Confirmed strengths and remaining limits

- No direct app-source React Native Text/TextInput bypass was found outside
  shared Text/TextField. Stack titles use shared Text. The 2× ceiling, ButtonRow
  font threshold and adaptive option/action width tokens have central owners.
- No confirmed new Settings save-scope or map-viewport containment bug was found.
  Auth forms have scrolling, keyboard avoidance and handled touch taps; sharing
  inputs now follow their corresponding choices.
- `LocationPicker.model.test.tsx:164` proves common ancestry and footer exclusion,
  not native projection or pin-tip alignment. This is the native limitation
  already recorded above, not a second geometry defect. Keep the store-flow
  coverage and verify actual map alignment on a supported native device.
- Native tab/map labels and OS date pickers are still outside the React Native
  Text wrapper. Their scaling remains unverified; they must not be described as
  having a proven 2× ceiling. A platform API limitation is not evidence of a new
  regression introduced by `7f18efc`.
- No application code was changed and no application tests were rerun for this
  read-only second pass. The 119-suite/531-test result above belongs to the first
  implementation, not this review. Documentation formatting/whitespace checks
  apply to the current changes; no native or browser observation was added.
