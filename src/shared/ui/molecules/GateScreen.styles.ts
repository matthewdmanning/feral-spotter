import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.layout.gutter,
    gap: theme.spacing.lg,
  },
  title: {
    ...theme.textVariants.heading,
    color: theme.colors.text,
    textAlign: 'center',
  },
  body: {
    ...theme.textVariants.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: theme.layout.stackGap,
    marginTop: theme.spacing.sm,
  },
}))
