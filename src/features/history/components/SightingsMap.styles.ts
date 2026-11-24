import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  frame: {
    height: theme.layout.mapHeight,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  map: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  errorCard: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  errorText: {
    ...theme.textVariants.body,
    color: theme.colors.text,
    textAlign: 'center',
  },
}))
