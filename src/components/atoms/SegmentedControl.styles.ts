import { StyleSheet } from 'react-native-unistyles'

// A track with a raised thumb on the selected option, rather than hard
// cells split by hairlines.
export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  label: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
  },
  // Base option — combined with selected/idle variant below
  option: {
    flex: 1,
    minHeight: theme.controlHeight.touchTarget,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Named variants for selected state — applied as array in JSX
  optionSelected: {
    backgroundColor: theme.colors.accent,
    ...theme.elevation.card,
  },
  optionIdle: { backgroundColor: 'transparent' },
  textSelected: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.accentText,
    textAlign: 'center',
  },
  textIdle: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.muted,
    textAlign: 'center',
  },
}))
