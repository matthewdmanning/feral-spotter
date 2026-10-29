/**
 * config/themes.ts
 * Color/spacing/radius/typography token definitions, one theme per export.
 *
 * Add a new theme by adding another export here and wiring it into the
 * `appThemes` map in unistyles.ts — nothing else needs to change.
 *
 * Palette: a warm, cozy scheme built with Google's material-color-utilities
 * as a Fidelity DynamicScheme (contrast 0) with three palettes swapped in:
 *   primary   moss seed, HCT(116, 44, 74); dark mode uses the seed itself
 *             as the accent, as Fidelity does
 *   neutral   warm brown, HCT hue 70, chroma 6 (variant chroma 10), so
 *             surfaces read as cream and cocoa instead of olive grey
 *   tertiary  terracotta, HCT hue 45, chroma 38 (segmented answers)
 * Secondary (sage) is Fidelity's own role from the seed. success and
 * warning are Blend.harmonize()'d toward the seed and read at tone 80
 * (dark) / 40 (light). Dark accentText is primary tone 20, one step darker
 * than Fidelity's onPrimaryContainer, so labels pass 5.4:1 on every
 * gradient stop. Regenerate from these inputs rather than hand-picking hex.
 *
 * Liquid glass: screens sit on `gradients.ambient` (soft pools of moss,
 * terracotta, and honey light, drawn by AmbientBackground). Cards, sheets,
 * and camera controls spread a `glass` surface: a translucent fill, a
 * hairline light edge, and a top-edge highlight. There is no backdrop blur
 * (that needs a native module); the ambient pools are smooth enough that a
 * translucent fill reads as glass without one. Secondary buttons are clear
 * sage glass with plain text; primary is tinted moss glass.
 *
 * `depth` is the button vocabulary: `raised` is a glass face (crisp top
 * rim, softer bottom rim, and a soft glow), `pressed` sinks the face with
 * an inset shadow, and `well` recesses a track (segmented control) so its
 * thumb sits in it. `gradients.bevel` is the sheen laid over every filled
 * button face. boxShadow inset needs Android 10+; older devices draw the
 * flat face.
 *
 * Type: Nunito, a rounded sans, loaded at startup (app/_layout.tsx). Each
 * weight is its own family on Android, so text sets `fontFamily` from
 * `fonts`, never `fontWeight`.
 */

// ─── Tokens (shared across themes) ───────────────────────────────────────────

/** 4pt grid. */
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

/**
 * Nested surfaces step down one size so inner corners stay concentric:
 * dialog (xxl) > card (xl) > input/thumbnail (md) > chip (sm).
 * Buttons use `full` — a pill reads as pressable at a glance.
 */
const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const

/**
 * Nunito faces by weight. Android has no weight synthesis for a custom
 * family, so every weight is a separate family name; set `fontFamily`
 * from here instead of `fontWeight`. Names match the keys passed to
 * `useFonts` in app/_layout.tsx.
 */
const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const

/**
 * Raw size scale. Prefer `textVariants` in styles; this is for one-offs.
 * One step above the stock 12/14/16/18/20/24/30 scale: body text stays
 * easy to read outdoors without crowding the screen.
 */
const typography = {
  xs: 14,
  sm: 16,
  base: 18,
  lg: 20,
  xl: 24,
  xxl: 28,
  xxxl: 34,
} as const

/**
 * Text roles. Spread into a style, then add color:
 *   title: { ...theme.textVariants.title, color: theme.colors.text }
 *
 * Sizes are dp — React Native already multiplies fontSize and lineHeight by
 * the OS font-scale setting, so do not multiply by `rt.fontScale` again.
 * Line heights sit on the 4pt grid; large text runs tighter (about 1.2) and
 * body text looser (about 1.5) for readability.
 *
 * Each heading role has its own size, so hierarchy reads from size first
 * and weight second: display 34 > title 28 > heading 20 > body 18.
 */
const textVariants = {
  display: {
    fontFamily: fonts.extrabold,
    fontSize: typography.xxxl,
    lineHeight: 40,
    letterSpacing: -0.4,
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: typography.xxl,
    lineHeight: 36,
    letterSpacing: -0.2,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: typography.lg,
    lineHeight: 28,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: typography.base,
    lineHeight: 28,
  },
  bodySmall: {
    fontFamily: fonts.regular,
    fontSize: typography.sm,
    lineHeight: 24,
  },
  label: { fontFamily: fonts.bold, fontSize: typography.base, lineHeight: 24 },
  labelSmall: {
    fontFamily: fonts.bold,
    fontSize: typography.sm,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fonts.semibold,
    fontSize: typography.xs,
    lineHeight: 20,
  },
} as const

/**
 * Layout rhythm. One gutter for every screen edge and one padding for every
 * card, so screens line up with each other. Groups sit further apart than
 * the items inside them (section > stack), so related things read as one.
 *
 * Layout values sit on the 8dp grid (mobile-ux-layout-best-practices.md §2):
 * gutter and card padding are both 16, so a card's text lines up 32dp from
 * the screen edge. stackGap stays 12, the Material button-group default.
 */
const layout = {
  gutter: spacing.lg,
  cardPadding: spacing.lg,
  stackGap: spacing.md,
  sectionGap: spacing.xxl,
} as const

const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
  hero: 64,
} as const

/**
 * Interactive heights. `touchTarget` is the Android Material minimum
 * (ux_principles.md); `control` is the standard button/input height, a step
 * above it so labels have room to breathe and to grow with font scaling —
 * apply as minHeight, never height.
 */
const controlHeight = {
  touchTarget: 48,
  control: 52,
} as const

/**
 * One color per cat, drawn over photos, so it must read on any photo and
 * stay apart from its neighbours. The first seven are the Okabe-Ito set,
 * chosen to stay distinct under the common color-vision deficiencies; the
 * violet is added for an eighth cat. None is the moss accent, so a cat's
 * color never reads as the active crop frame. Same in both themes: it sits on
 * photos, not on a themed surface. Append only — a cat stores its index.
 */
const catPalette = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#8E44AD',
] as const

/**
 * Viewfinder reticle drawn inside the Home entrypoint circles. The stroke is
 * a fixed width; the opacity lets the reticle recede behind the icon and
 * label it frames.
 */
const reticle = {
  thickness: 3,
  opacity: 0.5,
} as const

const sharedTokens = {
  catPalette,
  reticle,
  spacing,
  radius,
  fonts,
  typography,
  textVariants,
  layout,
  iconSize,
  controlHeight,
}

// ─── Themes ───────────────────────────────────────────────────────────────────

// Liquid-glass sheen over every filled button face: a bright top rim that
// fades smoothly, and a faint glow along the bottom edge where light
// refracts back through the "glass". No hard band — that reads as 2000s
// gloss, not glass.
const bevel =
  'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0) 68%, rgba(255,255,255,0.16) 100%)'
// Pressed dims the sheen and shades the top, so the face reads as sunk.
const bevelPressed =
  'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 40%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.10) 100%)'

export const darkTheme = {
  colors: {
    background: '#18120C',
    surface: '#251E17',
    surfaceAlt: '#302921',
    text: '#EEE0D4',
    textInverse: '#18120C',
    muted: '#D7C3B0',
    // The seed. Primary actions, active tab, focus.
    accent: '#B4BD58',
    accentAlt: '#9F8E7C',
    accentText: '#2F3300',
    accentSoft: '#454B00',
    accentSoftText: '#C4CE66',
    highlight: '#EEC148',
    // Answers and choices (segmented options): terracotta, so a chosen
    // answer never reads as the moss action color.
    selection: '#FFB692',
    selectionText: '#552001',
    // Secondary is clear, sage-tinted glass: a translucent fill that takes
    // the plain text color, so it sits a full step below the filled
    // primary.
    secondary: 'rgba(199,202,153,0.18)',
    onSecondary: '#EEE0D4',
    dangerStrong: '#FFB4AB',
    onDanger: '#690005',
    // Button rims: a bright edge where the glass catches light.
    accentRim: '#E1EA7F',
    secondaryRim: 'rgba(255,240,228,0.28)',
    dangerRim: '#FFDAD6',
    success: '#A0D756',
    danger: '#FFB4AB',
    warning: '#EEC148',
    border: '#524436',
    // Outlines that must read as a control edge: 5.9:1 on the background.
    borderStrong: '#9F8E7C',
    overlay: 'rgba(11,7,3,0.65)',
    cameraOverlay: 'rgba(0,0,0,0.40)',
    // Rendering primitives, not surfaces — a drop shadow, the camera preview's
    // own backdrop, the capture-flash effect, and content drawn over the live
    // camera feed are the same color in both themes by design. Named here
    // rather than left as inline hex so every color a component touches still
    // resolves through the theme.
    shadow: '#0B0703',
    cameraBackground: '#000000',
    flashEffect: '#FFFFFF',
    onCamera: '#FFFFFF',
    onCameraScrim: 'rgba(0,0,0,0.65)',
    onCameraBorder: 'rgba(255,255,255,0.3)',
  },
  // Dark surfaces separate by tint more than by shadow, so shadows run
  // heavier here just to stay visible at all.
  elevation: {
    raised: {
      shadowColor: '#0B0703',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  // Glass surfaces. Spread one in place of a solid surface and its elevation:
  //   card    cards and rows on a screen
  //   raised  dialogs and sheets over other content; near-opaque, so text
  //           stays legible over an overlay or a map
  //   chip    floating controls over the live camera feed
  // A translucent fill over the ambient backdrop, a hairline light edge, a
  // top-edge highlight, and a soft drop shadow. boxShadow, not Android
  // `elevation`: elevation draws its shadow through a translucent fill.
  glass: {
    card: {
      backgroundColor: 'rgba(255,236,220,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,240,228,0.12)',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.10), 0 8px 24px rgba(11,7,3,0.35)',
    },
    raised: {
      backgroundColor: 'rgba(48,41,33,0.94)',
      borderWidth: 1,
      borderColor: 'rgba(255,240,228,0.16)',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.14), 0 16px 40px rgba(11,7,3,0.55)',
    },
    chip: {
      backgroundColor: 'rgba(37,30,23,0.62)',
      borderWidth: 1,
      borderColor: 'rgba(255,240,228,0.18)',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.35)',
    },
  },
  // Dark labels pass 5.4:1 or better on every primary stop.
  gradients: {
    bevel,
    bevelPressed,
    // Soft pools of moss, terracotta, and honey light under the glass, so
    // translucent surfaces have something to show through. The pools sit
    // away from the top edge, so they never meet an opaque native header
    // at a visible seam.
    ambient:
      'radial-gradient(circle at 8% 24%, rgba(180,189,88,0.20) 0%, rgba(180,189,88,0) 58%), radial-gradient(circle at 96% 70%, rgba(255,182,146,0.15) 0%, rgba(255,182,146,0) 52%), radial-gradient(circle at 40% 108%, rgba(238,193,72,0.10) 0%, rgba(238,193,72,0) 48%)',
    primary: 'linear-gradient(135deg, #C4CE66 0%, #B4BD58 50%, #A4AD4A 100%)',
    primaryPressed: 'linear-gradient(135deg, #A4AD4A 0%, #B4BD58 100%)',
    tabBar:
      'linear-gradient(180deg, rgba(255,240,228,0.06) 0%, rgba(255,240,228,0) 100%), linear-gradient(180deg, #251E17 0%, #18120C 100%)',
    secondary:
      'linear-gradient(135deg, rgba(220,224,176,0.26) 0%, rgba(199,202,153,0.10) 100%)',
    secondaryPressed:
      'linear-gradient(135deg, rgba(199,202,153,0.10) 0%, rgba(199,202,153,0.20) 100%)',
    danger: 'linear-gradient(135deg, #FFC4BC 0%, #FFA399 100%)',
    dangerPressed: 'linear-gradient(135deg, #FFA399 0%, #FFB4AB 100%)',
  },
  depth: {
    // A crisp inner rim on top, a softer one along the bottom, and a soft
    // moss glow under the face.
    raised:
      'inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -1px 1px rgba(255,255,255,0.18), 0 6px 18px rgba(180,189,88,0.22), 0 2px 4px rgba(11,7,3,0.45)',
    raisedNeutral:
      'inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -1px 1px rgba(255,255,255,0.08), 0 4px 14px rgba(11,7,3,0.40)',
    pressed: 'inset 0 2px 6px rgba(11,7,3,0.45)',
    well: 'inset 0 2px 5px rgba(11,7,3,0.50), inset 0 -1px 0 rgba(255,255,255,0.06)',
  },
  ...sharedTokens,
} as const

export const lightTheme = {
  colors: {
    background: '#FFF8F4',
    surface: '#FFFFFF',
    surfaceAlt: '#F4E6DA',
    text: '#211A13',
    textInverse: '#FFF8F4',
    muted: '#524436',
    accent: '#5C6300',
    accentAlt: '#847464',
    accentText: '#FFFFFF',
    accentSoft: '#E1EA7F',
    accentSoftText: '#454B00',
    highlight: '#765A00',
    selection: '#8F4D29',
    selectionText: '#FFFFFF',
    secondary: 'rgba(94,97,57,0.10)',
    onSecondary: '#211A13',
    dangerStrong: '#BA1A1A',
    onDanger: '#FFFFFF',
    accentRim: '#454B00',
    secondaryRim: 'rgba(94,97,57,0.32)',
    dangerRim: '#690005',
    success: '#426900',
    danger: '#BA1A1A',
    warning: '#765A00',
    border: '#D7C3B0',
    borderStrong: '#847464',
    overlay: 'rgba(33,26,19,0.4)',
    cameraOverlay: 'rgba(0,0,0,0.30)',
    shadow: '#211A13',
    cameraBackground: '#000000',
    flashEffect: '#FFFFFF',
    onCamera: '#FFFFFF',
    onCameraScrim: 'rgba(0,0,0,0.65)',
    onCameraBorder: 'rgba(255,255,255,0.3)',
  },
  elevation: {
    raised: {
      shadowColor: '#211A13',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
  },
  // Frosted white glass on cream. The edge is a warm hairline, since a
  // white edge vanishes on a light page; the white top highlight stays.
  glass: {
    card: {
      backgroundColor: 'rgba(255,255,255,0.62)',
      borderWidth: 1,
      borderColor: 'rgba(132,116,100,0.18)',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 24px rgba(92,64,40,0.10)',
    },
    raised: {
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderWidth: 1,
      borderColor: 'rgba(132,116,100,0.20)',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,1), 0 16px 40px rgba(92,64,40,0.18)',
    },
    chip: {
      backgroundColor: 'rgba(255,255,255,0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.9)',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,1), 0 4px 12px rgba(0,0,0,0.25)',
    },
  },
  // White labels pass 5.9:1 or better on every primary stop.
  gradients: {
    bevel,
    bevelPressed,
    ambient:
      'radial-gradient(circle at 8% 24%, rgba(92,99,0,0.12) 0%, rgba(92,99,0,0) 58%), radial-gradient(circle at 96% 70%, rgba(143,77,41,0.10) 0%, rgba(143,77,41,0) 52%), radial-gradient(circle at 40% 108%, rgba(238,193,72,0.16) 0%, rgba(238,193,72,0) 48%)',
    primary: 'linear-gradient(135deg, #666D0D 0%, #5C6300 50%, #505700 100%)',
    primaryPressed: 'linear-gradient(135deg, #505700 0%, #5C6300 100%)',
    tabBar:
      'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(255,241,230,0.9) 100%)',
    secondary:
      'linear-gradient(135deg, rgba(255,255,255,0.70) 0%, rgba(94,97,57,0.08) 100%)',
    secondaryPressed:
      'linear-gradient(135deg, rgba(94,97,57,0.12) 0%, rgba(255,255,255,0.50) 100%)',
    danger: 'linear-gradient(135deg, #C82623 0%, #AC0C12 100%)',
    dangerPressed: 'linear-gradient(135deg, #AC0C12 0%, #BA1A1A 100%)',
  },
  depth: {
    raised:
      'inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -1px 1px rgba(255,255,255,0.12), 0 6px 18px rgba(92,99,0,0.22), 0 1px 3px rgba(33,26,19,0.20)',
    raisedNeutral:
      'inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -1px 1px rgba(255,255,255,0.5), 0 4px 14px rgba(92,64,40,0.12)',
    pressed: 'inset 0 2px 6px rgba(33,26,19,0.22)',
    well: 'inset 0 2px 4px rgba(33,26,19,0.12), inset 0 -1px 0 rgba(255,255,255,0.8)',
  },
  ...sharedTokens,
} as const
