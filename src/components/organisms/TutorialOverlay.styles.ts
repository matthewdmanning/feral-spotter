import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  // Rendered inside RN's Modal, full-bleed over the annotate screen — the
  // fixed top: 56 / paddingBottom: 100 below used to happen to clear the
  // status bar and gesture bar rather than actually accounting for them.
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.xxl,
    paddingBottom: rt.insets.bottom + 100,
  },
  skipBtn: {
    position: 'absolute',
    top: rt.insets.top + theme.spacing.md,
    right: theme.spacing.xxl,
    minHeight: theme.controlHeight.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  skipText: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xxl,
    ...theme.elevation.raised,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.md,
  },
  counter: { ...theme.textVariants.caption, color: theme.colors.highlight },
  title: { ...theme.textVariants.heading, color: theme.colors.text },
  body: { ...theme.textVariants.body, color: theme.colors.muted },
  primary: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  primaryText: { ...theme.textVariants.label, color: theme.colors.accentText },
}))
