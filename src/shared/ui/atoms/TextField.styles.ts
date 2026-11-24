import type { UnistylesThemes } from 'react-native-unistyles'
import { StyleSheet } from 'react-native-unistyles'

type Theme = UnistylesThemes[keyof UnistylesThemes]

/**
 * The surface of every input-shaped control: TextField and the Date/Time
 * trigger (STYLE-6). One definition, so the two cannot drift; the edge is
 * `borderStrong`, 3:1+ against the fill and the card.
 */
export function fieldSurface(theme: Theme) {
  return {
    minHeight: theme.controlHeight.control,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: theme.borderWidth.control,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  }
}

export const styles = StyleSheet.create((theme) => ({
  group: { gap: theme.spacing.sm },
  label: { ...theme.textVariants.labelSmall, color: theme.colors.muted },
  focused: { borderColor: theme.colors.accent },
  input: {
    ...theme.textVariants.body,
    ...fieldSurface(theme),
    color: theme.colors.text,
  },
}))
