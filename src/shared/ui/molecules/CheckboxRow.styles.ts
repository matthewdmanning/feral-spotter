import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  // minHeight, never height: the label wraps at large font sizes.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.layout.stackGap,
    minHeight: theme.controlHeight.touchTarget,
    paddingVertical: theme.spacing.sm,
  },
  label: {
    ...theme.textVariants.body,
    color: theme.colors.text,
    flexShrink: 1,
  },
}))
