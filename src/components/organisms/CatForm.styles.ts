import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    ...theme.outlined,
  },
  inner: { padding: theme.spacing.xl, gap: theme.spacing.xl },
  section: { gap: theme.spacing.md },
  actions: { gap: theme.spacing.md },
}))
