/**
 * config/themes.ts
 * Color/spacing/radius/typography token definitions, one theme per export.
 *
 * Add a new theme by adding another export here and wiring it into the
 * `appThemes` map in unistyles.ts — nothing else needs to change.
 *
 * Palette: "cat's-eye at dusk". Neutrals carry a faint blue-green tint
 * (night sky in dark mode, sage in light mode) instead of flat grey. The
 * fern-teal accent marks every primary action; amber `highlight` is the
 * eye-shine — kept rare (viewfinder corners, active indicators) so it stays
 * the one thing that reads as Feral Spotter.
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const

/** Raw size scale. Prefer `textVariants` in styles; this is for one-offs. */
const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
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
  display: {
    fontSize: typography.xxxl,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: typography.xxl,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  heading: {
    fontSize: typography.lg,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  body: { fontSize: typography.base, lineHeight: 24, fontWeight: '400' },
  bodySmall: { fontSize: typography.sm, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: typography.base, lineHeight: 20, fontWeight: '600' },
  labelSmall: { fontSize: typography.sm, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: typography.xs, lineHeight: 16, fontWeight: '500' },
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

export const darkTheme = {
  colors: {
    background: '#0E1517',
    surface: '#172124',
    surfaceAlt: '#1F2B2F',
    text: '#E8EEEC',
    textInverse: '#0E1517',
    muted: '#9AABA8',
    // Bright enough to read as the action color on the night background, so
    // its label flips to dark text (white on this teal fails contrast).
    accent: '#3CC4A8',
    accentAlt: '#6F8682',
    accentText: '#04241E',
    // Tinted container: selected/confirmed states that should not shout.
    accentSoft: '#173A34',
    accentSoftText: '#8FE6D2',
    highlight: '#F2B441',
    success: '#3DBE7E',
    danger: '#F0686C',
    warning: '#F0A43A',
    border: '#26363A',
    // Outlines that must read as a control edge (secondary buttons, inputs).
    borderStrong: '#4A5F63',
    overlay: 'rgba(4,10,12,0.6)',
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
  ...sharedTokens,
} as const

export const lightTheme = {
  colors: {
    background: '#F3F6F4',
    surface: '#FFFFFF',
    surfaceAlt: '#E8EFEC',
    text: '#13201D',
    textInverse: '#F3F6F4',
    muted: '#566763',
    accent: '#0E7C6B',
    accentAlt: '#5E716D',
    accentText: '#FFFFFF',
    accentSoft: '#D6EFE8',
    accentSoftText: '#0A5A4D',
    highlight: '#9A6508',
    success: '#1D8049',
    danger: '#C4342C',
    warning: '#B45F09',
    border: '#DCE5E1',
    borderStrong: '#93A6A1',
    overlay: 'rgba(14,26,24,0.4)',
    cameraOverlay: 'rgba(0,0,0,0.30)',
    shadow: '#0E2420',
    cameraBackground: '#000000',
    flashEffect: '#FFFFFF',
    onCamera: '#FFFFFF',
    onCameraScrim: 'rgba(0,0,0,0.65)',
    onCameraBorder: 'rgba(255,255,255,0.3)',
  },
  elevation: {
    card: {
      shadowColor: '#0E2420',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    raised: {
      shadowColor: '#0E2420',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 8,
    },
  },
  ...sharedTokens,
} as const
