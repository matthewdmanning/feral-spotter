import { StyleSheet } from 'react-native-unistyles'

// A borderless, text-only action: links, Skip, Clear, Decline. The touch
// area keeps the 48dp floor even though only the label is drawn.
export const styles = StyleSheet.create((theme) => ({
  base: {
    minHeight: theme.controlHeight.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.textVariants.labelSmall,
    variants: {
      tone: {
        accent: { color: theme.colors.accent },
        muted: { color: theme.colors.muted },
        danger: { color: theme.colors.danger },
      },
      underline: {
        true: { textDecorationLine: 'underline' },
        false: {},
      },
    },
  },
  disabled: { opacity: 0.5 },
}))
