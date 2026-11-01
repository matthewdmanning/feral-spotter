import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.layout.gutter,
  },
  title: {
    ...theme.textVariants.title,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  fields: { gap: theme.spacing.md },
  button: { width: '100%', marginTop: theme.spacing.lg },
}))
