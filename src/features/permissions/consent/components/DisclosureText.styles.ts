import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  paragraph: {
    ...theme.textVariants.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  item: {
    ...theme.textVariants.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    marginLeft: theme.spacing.md,
    flexShrink: 1,
  },
  itemLabel: { fontFamily: theme.fonts.bold },
}))
