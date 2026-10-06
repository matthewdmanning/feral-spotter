/**
 * config/themes.ts
 * Color/spacing/radius/typography token definitions, one theme per export.
 *
 * Add a new theme by adding another export here and wiring it into the
 * `appThemes` map in unistyles.ts — nothing else needs to change.
 *
 * Palette: Material 3 "Fidelity" scheme generated from the neon seed
 * #C6E84A with Google's material-color-utilities (SchemeFidelity, contrast
 * 0). Fidelity keeps the seed itself as the primary container, so the neon
 * survives into the UI; secondary (sage), tertiary (lavender) and error are
 * the scheme's own roles, already harmonized to the seed. success and
 * warning are Blend.harmonize()'d toward the seed and read at tone 80
 * (dark) / 40 (light), the same tones the scheme uses for its accents.
 * Regenerate from the seed rather than hand-picking a new hex.
 *
 * `depth` is the button vocabulary: `raised` is a bevel (top-edge light plus
 * a drop shadow), `pressed` sinks the face with an inset shadow, and `well`
 * recesses a track (segmented control) so its thumb sits in it.
 * `gradients.bevel` is a gradient inset laid over every filled button face:
 * light at the top, shade at the bottom, so the face reads as having height.
 * boxShadow inset needs Android 10+; older devices draw the flat face.
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
 * Raw size scale. Prefer `textVariants` in styles; this is for one-offs.
 * Each step sits two steps above the stock 12/14/16/18/20/24/30 scale, so
 * every text role reads larger than platform default.
 */
const typography = {
  xs: 16,
  sm: 18,
  base: 20,
  lg: 24,
  xl: 26,
  xxl: 34,
  xxxl: 40,
} as const

/**
 * Text roles. Spread into a style, then add color:
 *   title: { ...theme.textVariants.title, color: theme.colors.text }
 *
 * Sizes are dp — React Native already multiplies fontSize and lineHeight by
 * the OS font-scale setting, so do not multiply by `rt.fontScale` again.
 * Line heights sit on the 4pt grid; large text runs tighter (1.2) and body
 * text looser (1.5) for readability.
 */
const textVariants = {
  // Every heading role shares one size; weight alone separates them.
  display: {
    fontSize: typography.lg,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: typography.lg,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  heading: {
    fontSize: typography.lg,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  body: { fontSize: typography.base, lineHeight: 28, fontWeight: '400' },
  bodySmall: { fontSize: typography.sm, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: typography.base, lineHeight: 26, fontWeight: '600' },
  labelSmall: { fontSize: typography.sm, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: typography.xs, lineHeight: 20, fontWeight: '500' },
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

const sharedTokens = {
  spacing,
  radius,
  typography,
  textVariants,
  iconSize,
  controlHeight,
}

// ─── Themes ───────────────────────────────────────────────────────────────────

const bevel =
  'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.22) 100%)'
// Pressed flips the shading: shade on top, so the face reads as sunk.
const bevelPressed =
  'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 45%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.12) 100%)'

export const darkTheme = {
  colors: {
    background: '#12140B',
    surface: '#1E2116',
    surfaceAlt: '#292B20',
    text: '#E3E4D3',
    textInverse: '#12140B',
    muted: '#C5C9B0',
    // The seed. Primary actions, active tab, focus.
    accent: '#C6E84A',
    accentAlt: '#8F937C',
    accentText: '#2A3500',
    accentSoft: '#3F4C12',
    accentSoftText: '#ADBC76',
    highlight: '#EEC148',
    // Answers and choices (segmented options): the scheme's tertiary, so a
    // chosen answer never reads as the neon action color.
    selection: '#DBD6FF',
    selectionText: '#2F2D4C',
    secondary: '#BECE86',
    onSecondary: '#2A3500',
    dangerStrong: '#FFB4AB',
    onDanger: '#690005',
    // Solid button rims.
    accentRim: '#EEFFAE',
    secondaryRim: '#E0EDB2',
    dangerRim: '#FFDAD6',
    success: '#92D875',
    danger: '#FFB4AB',
    warning: '#EEC148',
    border: '#454936',
    // Outlines that must read as a control edge: 5.9:1 on the background.
    borderStrong: '#8F937C',
    overlay: 'rgba(8,9,4,0.65)',
    cameraOverlay: 'rgba(0,0,0,0.40)',
    // Rendering primitives, not surfaces — a drop shadow, the camera preview's
    // own backdrop, the capture-flash effect, and content drawn over the live
    // camera feed are the same color in both themes by design. Named here
    // rather than left as inline hex so every color a component touches still
    // resolves through the theme.
    shadow: '#000000',
    cameraBackground: '#000000',
    flashEffect: '#FFFFFF',
    onCamera: '#FFFFFF',
    onCameraScrim: 'rgba(0,0,0,0.65)',
    onCameraBorder: 'rgba(255,255,255,0.3)',
  },
  // Dark surfaces separate by tint more than by shadow, so shadows run
  // heavier here just to stay visible at all.
  elevation: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 2,
    },
    raised: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  // A solid edge for cards and rows: the fill alone sits too close to the
  // page to read as a container. Spread alongside elevation.card.
  outlined: { borderWidth: 1.5, borderColor: '#8F937C' },
  // Dark labels pass 6.4:1 or better on every stop.
  gradients: {
    bevel,
    bevelPressed,
    primary: 'linear-gradient(180deg, #EEFFAE 0%, #C6E84A 55%, #A9CC2C 100%)',
    primaryPressed: 'linear-gradient(180deg, #A9CC2C 0%, #C6E84A 100%)',
    tabBar: 'linear-gradient(180deg, #1E2116 0%, #12140B 100%)',
    secondary: 'linear-gradient(180deg, #D3E29B 0%, #AEBE76 100%)',
    secondaryPressed: 'linear-gradient(180deg, #AEBE76 0%, #BECE86 100%)',
    danger: 'linear-gradient(180deg, #FFC9C2 0%, #FF9F94 100%)',
    dangerPressed: 'linear-gradient(180deg, #FF9F94 0%, #FFB4AB 100%)',
  },
  depth: {
    raised:
      'inset 0 1px 0 rgba(255,255,255,0.45), 0 4px 14px rgba(198,232,74,0.22), 0 2px 4px rgba(0,0,0,0.5)',
    raisedNeutral:
      'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.45)',
    pressed: 'inset 0 3px 6px rgba(0,0,0,0.45)',
    well: 'inset 0 2px 5px rgba(0,0,0,0.6)',
  },
  ...sharedTokens,
} as const

export const lightTheme = {
  colors: {
    background: '#FAFAE9',
    surface: '#FFFFFF',
    surfaceAlt: '#E9E9D8',
    text: '#1A1D12',
    textInverse: '#FAFAE9',
    muted: '#454936',
    accent: '#536600',
    accentAlt: '#757964',
    accentText: '#FFFFFF',
    accentSoft: '#D7E79D',
    accentSoftText: '#3F4C12',
    highlight: '#765A00',
    selection: '#5E5B7D',
    selectionText: '#FFFFFF',
    secondary: '#576428',
    onSecondary: '#FFFFFF',
    dangerStrong: '#BA1A1A',
    onDanger: '#FFFFFF',
    accentRim: '#3F4C00',
    secondaryRim: '#3F4A14',
    dangerRim: '#93000A',
    success: '#2C6C15',
    danger: '#BA1A1A',
    warning: '#765A00',
    border: '#C5C9B0',
    borderStrong: '#757964',
    overlay: 'rgba(26,29,18,0.4)',
    cameraOverlay: 'rgba(0,0,0,0.30)',
    shadow: '#1A1D12',
    cameraBackground: '#000000',
    flashEffect: '#FFFFFF',
    onCamera: '#FFFFFF',
    onCameraScrim: 'rgba(0,0,0,0.65)',
    onCameraBorder: 'rgba(255,255,255,0.3)',
  },
  elevation: {
    card: {
      shadowColor: '#1A1D12',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    raised: {
      shadowColor: '#1A1D12',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 8,
    },
  },
  outlined: { borderWidth: 1.5, borderColor: '#757964' },
  // White labels pass 5.1:1 or better on every stop.
  gradients: {
    bevel,
    bevelPressed,
    primary: 'linear-gradient(180deg, #5F7500 0%, #536600 55%, #435300 100%)',
    primaryPressed: 'linear-gradient(180deg, #435300 0%, #536600 100%)',
    tabBar: 'linear-gradient(180deg, #FFFFFF 0%, #EFEFDE 100%)',
    secondary: 'linear-gradient(180deg, #66733A 0%, #4A5620 100%)',
    secondaryPressed: 'linear-gradient(180deg, #4A5620 0%, #576428 100%)',
    danger: 'linear-gradient(180deg, #C8302B 0%, #A11414 100%)',
    dangerPressed: 'linear-gradient(180deg, #A11414 0%, #BA1A1A 100%)',
  },
  depth: {
    raised:
      'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px rgba(83,102,0,0.25), 0 1px 3px rgba(26,29,18,0.2)',
    raisedNeutral:
      'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(26,29,18,0.12)',
    pressed: 'inset 0 3px 6px rgba(26,29,18,0.35)',
    well: 'inset 0 2px 4px rgba(26,29,18,0.18)',
  },
  ...sharedTokens,
} as const
