# Project UI/UX standards

Read these standards before designing, implementing or reviewing UI, including
copy, accessibility text, layout, styling and shared components. They apply to
all project screens, not just organization sharing.

Use these general standards with the relevant product design documents and
[design-decision policy](ui-ux/reference/using-design-decisions.md). Respect the
policy's instruction priority and confirmation requirements for authoritative
design files. Report conflicts rather than silently rewriting product decisions.

## Minimums are not optimum values

**Every minimum in this guide is a floor, not an optimum value or a design
recommendation to use that exact value.** Meeting a touch-target, spacing,
font-scaling or contrast threshold does not establish a comfortable, balanced or
legible screen. Choose the final values for the content, viewing conditions,
interaction and available space, then review the whole composition. Do not set
all sizes, gaps or contrast pairs to their minimum simply because they pass.
Larger components or more whitespace are not automatically better either.

## Consistent sizing and typography within a screen

- Components with the same role on a screen must use the same sizing contract:
  minimum height, padding, radius, icon size and label typography. Equal-priority
  actions in a row should have balanced widths and a common height; labels may
  wrap and grow the group together rather than leaving mismatched button faces.
- Use the project font family and its supplied faces for app-rendered text;
  retain platform fonts in OS-owned UI. Text with the same semantic role must
  share font size, weight/face, line height, letter spacing and the enforced
  scaling ceiling. Use the established typography hierarchy for intentional differences
  between titles, section headings, labels, content and supplementary text.
- Do not introduce one-off font sizes, weights, icon dimensions or control
  heights to fit individual strings. Resolve long copy with wrapping, reflow or
  placement while retaining the role's shared tokens.
- Keep sizing and typography consistent across default, selected, loading and
  error states. State changes must not unexpectedly move adjacent components or
  change an action's dimensions. Maintain that consistency in both themes.

## Placement and visual hierarchy

- Group controls by the user's task and the data they affect. Keep labels,
  dependent inputs, status and related actions together. Place a conditional
  input immediately beneath the choice that reveals it.
- Put sighting-level information and permissions beside the sighting summary;
  keep per-cat information within the cat section. Do not bury sighting-level
  actions below an arbitrarily long list of cats.
- Keep related settings adjacent. Distinguish independently saved sections
  through ownership, grouping and action placement. Do not explain conflicting
  Save/Discard behavior with helper copy.
- Use screen-title typography for screen titles, heading typography for cards
  and sections, label typography for control/group labels, and body/supplementary
  roles for content and status. Expose actual headings to assistive technology.
- Make the primary action visually clear. Keep rare destructive actions away
  from the primary thumb action; give destructive confirmation a specific target
  and scope. Avoid redundant or competing primary actions.
- Prefer a small number of meaningful groups over a flat sequence of unrelated
  controls or a separate decorative card for every row.

## Padding, spacing and alignment

- Use project layout, spacing and radius tokens. Use card padding inside the
  surface, a larger gap between sections and a smaller gap within related groups.
  Host layouts own inter-card spacing; avoid adding another margin to each card.
- Distribute components deliberately across the usable screen. Use balanced
  outer gutters and a regular rhythm of larger section gaps and smaller
  within-group gaps. Give equal-priority siblings consistent spacing, and keep
  related labels, fields and actions perceptually close.
- Place surplus space at intentional section boundaries or around the primary
  composition. Do not spread every child with `space-between` just to fill a
  tall viewport, or compress the last section against a pinned footer. Keep
  scrolling content and pinned actions clearly separated.
- Review the distribution on short and narrow phones, landscape and wider
  screens. Avoid a crowded edge and an otherwise empty opposite side; use
  bounded content widths and coherent groups when extra width is available.
- Align headings, body text, dividers and actions to a consistent content edge.
  Align dependent fields with the associated control label. Use logical
  start/end padding where direction matters.
- Align a checkbox or icon with the first line of a multiline label. Keep the
  indicator from shrinking. Account for runtime font scale when aligning a
  fixed-size indicator with scaled text; do not double-scale text itself.
- Keep paragraphs and form labels aligned to the reading direction. Reserve
  centered text for intentionally centered compositions or short empty states.
- Let long names and action labels wrap within the available width. Use
  flexible text widths and shrinking in horizontal layouts; do not shrink fonts
  or truncate consent, errors or essential actions to conceal overflow.
- Use minimum heights rather than fixed heights for text-bearing controls.
  Maintain at least 48dp touch targets and at least 8dp between adjacent targets.
- Respect screen gutters, safe areas, system bars, tab bars, pinned actions and
  the keyboard. Test the actual host layout before adding duplicate insets.
  Ensure focused inputs and their actions remain reachable while typing.
- Render only meaningful sections. Empty conditional wrappers must not create
  blank gaps, orphaned dividers or empty footers.

## Font scaling and the enforced maximum

- The app must enforce one centrally configured maximum font-scale multiplier
  of **2.0× for all app-rendered text**, including body content, input text,
  consent, validation errors, headings, navigation and action labels. Essential
  text is not exempt: text outside a component's visible/reachable area cannot
  be read.
- Apply the ceiling through the shared text/input components and text-bearing
  controls, including `Text` and `TextInput` scaling props. Verify that inherited
  defaults, third-party controls and local overrides cannot silently remove it.
  An uncapped default or a documented limit without runtime enforcement does
  not meet this standard.
- Keep system font scaling enabled up to the ceiling. Respect the user's
  preferred scale and clamp larger requests at 2.0×; do not render every label
  at 2.0× by default. This maximum is a protective ceiling, not an optimum font
  size or a substitute for the semantic typography hierarchy.
- Use the same ceiling throughout a screen and across shared controls. Do not
  introduce smaller per-component caps, disable scaling or automatically shrink
  individual labels to make a layout fit. Change the layout instead.
- Every text-bearing component must accommodate its content at the enforced
  maximum. Allow wrapping, reflow, content-driven heights and scrolling as
  appropriate. Keep inputs, essential actions, consent and error messages
  visible or reachable without clipping, overlap or hidden words. A cap alone
  does not prove that text fits.
- Test default scale, the 2.0× ceiling and the largest platform-supported
  accessibility setting. At the last setting, verify that app-rendered text
  actually remains capped and that its layout remains usable. Record runtime
  checks separately from the policy; adding this guide does not itself enforce
  scaling in application code. OS-owned dialogs and keyboards retain platform
  typography.

## Semantic tokens and shared components

- Use the project's shared controls and theme system. Raw palette values belong
  in theme definitions, not component styles or inline props.
- Choose tokens for their meaning, not because their current numeric value
  happens to match. Use the relevant foreground for a surface: on-accent text
  or icons on accent, on-danger on a danger fill, and normal/muted text on
  content surfaces. A page-background token is not a control foreground.
- Use typography variants and their font families; do not synthesize custom
  font weights in components. Use the project icon vocabulary for indicators
  instead of a font-scaled text glyph inside a fixed box.
- Reuse layout, spacing, radius, border, icon-size, control-size and touch-target
  tokens where their roles fit. Add a narrowly named semantic token to the theme
  if the needed role is missing. Do not substitute a photo-frame or icon-size
  token for an unrelated control dimension.
- Native hairline widths, safe-area values, runtime font scale, percentages and
  structural flex/alignment constraints are legitimate layout inputs. Audit
  them by role; do not replace them with unrelated theme aliases.
- Review both appearances, including muted text, selected states, outlines and
  disabled controls. Do not rely on color alone to communicate a state.

## Component, background and text contrast

- Review the complete contrast chain: screen background, component fill or
  boundary, and the text/icons inside it. Text must contrast with the component's
  actual visible background; a readable component edge does not establish
  readable text, and readable text alone does not identify an interactive shape.
- Keep normal text at least 4.5:1 and qualifying large text at least 3:1 against
  its actual background. Essential control boundaries, focus/selection indicators
  and meaningful icons need at least 3:1 against adjacent colors. Do not round
  a failing ratio into a pass or assume every heading qualifies as large text.
- Where a component boundary is needed to identify a control, give its fill or
  outline sufficient contrast against the surrounding screen/surface. Decorative
  card boundaries can use hierarchy, grouping and depth; do not apply an
  interactive-boundary rule indiscriminately to every glass card.
- Use the correct semantic foreground for each fill, including selected,
  pressed, loading and error states. Check muted/helper text, input placeholders,
  focus outlines, check marks and disabled-state legibility as well as headings.
  Reduced emphasis must not make necessary content unreadable.
- Test both themes and the actual transparency/compositing over the screen's
  lightest, darkest and most variable backdrop regions. Glass tint, opacity,
  blur and an underlying gradient change the effective background. Solid-token
  calculations alone do not prove native glass contrast; retain the accessible
  opaque fallback.
- Contrast thresholds are minimums. Prefer comfortable contrast for sustained
  reading and real viewing conditions while preserving the intended visual
  hierarchy. Do not treat a barely passing ratio as the aesthetic target.

## Native glass surfaces

- Use the project's `GlassSurface` abstraction for glass cards/sheets and the
  existing ambient screen background. Pass the appropriate semantic surface
  kind and radius. Preserve the shared button treatment for actions.
- Keep groups inside a glass card transparent unless a separate filled control
  has a clear purpose. Avoid nested glass layers, opaque local card fills,
  excessive rims or improvised CSS blur that hides or imitates native glass.
- Preserve the native platform path: LiquidGlassView on supported Android and
  Expo GlassView on supported iOS. Check the radius and tint passed through the
  adapter, not only the React Native style object.
- Preserve the shared theme-surface fallback for reduced transparency/high
  contrast, unsupported glass APIs and native backdrop/pipeline failures. Never
  force transparency over an accessibility preference.
- Do not place glass over a live camera preview or native map. Follow the
  project's solid-surface treatment for those screens.
- Inspect glass on a device over the actual ambient background, in both themes.
  A passing props test or browser approximation is not visual glass sign-off.

## UI copy

- Do not include copy that explains the detailed function or behavior of
  buttons, checkboxes, switches, inputs, dialogs or other components. This
  applies to visible text, helper text, tooltips, accessibility labels/hints and
  configured strings.
- Use concise action labels, field labels, validation errors and current status.
  Keep required consent and material service facts concise: what data is shared,
  who receives it, whether delivery exists and the limits of revocation. These
  facts describe the service and authorization, not how a control works.
- Do not narrate clicks, checked defaults, control overrides, Save/Discard scope,
  component state changes or internal synchronization/validation steps. Fix
  confusing labels, grouping or interaction instead. Keep implementation detail
  in developer documentation.
- For example, use “Save sharing preferences” and “Permission pending”; do not
  add “This Save button applies only to this card”. “Organization delivery is
  not available yet” is a material service limitation.
- Store feature copy separately from component code, including headings,
  statuses, dialogs, errors, accessibility text and dynamic sentence templates.
  Keep complete translatable labels; do not build sentences by lowercasing nouns.
- Keep schema keys separate from display text. Use named placeholders, preserve
  inserted user/catalog values and the device locale for dates. Document how
  configuration is applied and whether a rebuild is required.
- Review every added/changed string in its rendered context, including offline,
  conditional, error and accessibility states. Keyword searches alone cannot
  enforce this semantic rule.

## Human reachability and state review

- For each finding, give a real entry point, prerequisites, user actions and
  resulting UI. State rollout, authentication, connectivity and platform gates.
- Store injection, mocked authentication or a theoretical service limit does
  not establish a human path. Distinguish reachable user journeys, asynchronous
  service changes, defensive states and future/deferred capabilities.
- Check whether the relevant action actually exists on that screen and whether
  a modal obscures the controls. Do not invent interactions through a modal.
- Respect deduplication, immutable grants and request coalescing when assessing
  repeated taps; a repeated tap does not by itself prove a duplicate write.
- Keep loading, empty, failed and stale/offline states distinct where their
  consequences differ. Provide appropriate progress, retry and outcome feedback,
  within the supported visual interaction scope below.
- Identify destructive targets and repeated actions in accessible labels.
  Consent summaries must reflect the effective data, including absent values.
- Measure realistic account/list sizes before calling an admission-limit fixture
  a performance defect. Use grouping, progressive disclosure and virtualization
  when actual list size and interaction require them.

## Verification and review evidence

- Inspect component composition and resolved styles, then exercise meaningful
  user journeys. Use real stores/controls and substitute external/native services
  only at their boundary, following the [testing policy](testing.md).
- Check a narrow phone, long configured copy and organization names, 200% text,
  the enforced font-scale ceiling, keyboard-visible forms, both themes,
  reduced transparency. Include permission review, offline retry and destructive states
  when they are human-reachable.
- Add load-bearing regression tests for concrete failures. Verify rendering and
  behavior rather than claiming a source-text/regex check proves layout.
- Report source inspection, rendered-component tests, theme contrast
  calculations and native device observations separately.
  Screenshots, bundling and mocked native props establish different things.
- Attempt native device testing where supported and name the actual blocker
  when unavailable. Mark physical layout, keyboard behavior or native glass as
  unverified when they were not exercised.
- Keep general standards here, product-specific design in the authoritative
  design files and change-specific findings/validation in implementation notes.

## References

- [Mobile UX and layout best practices](ui-ux/reference/mobile-ux-layout-best-practices.md)
- [Mobile UX principles](ui-ux/reference/ux_principles.md)
- [Using design decisions](ui-ux/reference/using-design-decisions.md)
- [Testing policy](testing.md)

## Supported platforms and visual interaction scope

FeralSpotter is a native mobile app for field work. Web is not a supported
platform. Do not include web compatibility, browser rendering, web builds or
browser-based app validation in reviews, checks, tests or implementations.
Missing web dependencies or unsupported browser behavior are not app defects.
Use native mobile evidence to validate the app's UI and interactions.

Because the app's field tasks inherently require visual observation,
photography and visual annotation, features for very low vision or nonvisual
operation, including text-to-speech (TTS), screen readers and spoken navigation,
are outside product scope. Do not include those features or their requirements
in reviews, checks, tests or implementations. Do not report their absence as a
defect or list their validation as pending work. This scope takes precedence
over broader accessibility or browser-testing recommendations in the reference
documents and external guides.

Visual usability requirements remain in scope: readable contrast, text scaling
up to the enforced 2.0× ceiling, reflow, touch targets, keyboard reachability,
clear visible feedback, both themes and reduced-transparency/high-contrast
surface behavior. This exclusion does not require removing existing labels or
semantics from controls.
