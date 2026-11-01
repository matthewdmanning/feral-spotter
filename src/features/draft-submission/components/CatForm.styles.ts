import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  card: {
    borderRadius: theme.radius.xl,
  },
  inner: { padding: theme.layout.cardPadding, gap: theme.spacing.lg },
  section: { gap: theme.spacing.md },
}))
