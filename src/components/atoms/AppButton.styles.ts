import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  base: {
    minHeight: theme.controlHeight.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    variants: {
      variant: {
        // The eyeshine gradient is applied inline by AppButton (RN processes
        // backgroundImage in JS); this solid color is its fallback.
        // Filled variants carry a solid rim plus a gradient face (applied
        // inline by AppButton, since RN processes backgroundImage in JS);
        // the solid backgroundColor is the gradient's fallback.
        primary: {
          backgroundColor: theme.colors.accent,
          borderWidth: 1.5,
          borderColor: theme.colors.accentRim,
          boxShadow: theme.depth.raised,
        },
        secondary: {
          backgroundColor: theme.colors.secondary,
          borderWidth: 1.5,
          borderColor: theme.colors.secondaryRim,
          boxShadow: theme.depth.raisedNeutral,
        },
        ghost: { backgroundColor: 'transparent' },
        danger: {
          backgroundColor: theme.colors.dangerStrong,
          borderWidth: 1.5,
          borderColor: theme.colors.dangerRim,
          boxShadow: theme.depth.raisedNeutral,
        },
      },
      size: {
        default: {},
        // Actual size comes from AppButton's `diameter` prop (screen-dependent,
        // computed by the caller) — borderRadius here is a pre-diameter
        // fallback, overridden once `diameter` is set.
        circle: {
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.lg,
          ...theme.elevation.raised,
        },
        compact: { paddingHorizontal: theme.spacing.md },
      },
    },
  },
  label: {
    ...theme.textVariants.labelSmall,
    textAlign: 'center',
    variants: {
      variant: {
        primary: { color: theme.colors.accentText },
        secondary: { color: theme.colors.onSecondary },
        ghost: { color: theme.colors.muted },
        danger: { color: theme.colors.onDanger },
      },
      size: {
        default: {},
      },
    },
  },
  flex1: { flex: 1 },
  // 0.5 tanked label contrast on the accent background (ux_principles.md
  // contrast minimums) — 0.7 still reads as disabled, stays legible.
  disabled: { opacity: 0.7 },
  // The face sinks: bevel swaps for an inset shadow and the button drops a
  // pixel, so a press reads as a physical click, not a fade.
  pressed: {
    boxShadow: theme.depth.pressed,
    transform: [{ translateY: 1 }, { scale: 0.97 }],
  },
}))
