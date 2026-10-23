import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textGroup: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.lg,
  },
  label: { ...theme.textVariants.label, color: theme.colors.text },
  hint: { ...theme.textVariants.bodySmall, color: theme.colors.muted },
  // The bare Switch is under 48dp tall; this wrapper is the touch target.
  switchTarget: {
    minWidth: theme.controlHeight.touchTarget,
    minHeight: theme.controlHeight.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
