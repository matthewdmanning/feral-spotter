import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  // No top inset here: this screen renders its own Stack.Screen header
  // (headerShown, see index.tsx), which already reserves the status-bar
  // space — an rt.insets.top on top of that double-pads the content.
  root: { backgroundColor: theme.colors.background },
  inner: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xxl,
    fontWeight: '700',
  },
  total: { color: theme.colors.muted, fontSize: theme.typography.sm },
  empty: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xxxl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  emptyTitle: { color: theme.colors.muted, fontSize: theme.typography.base },
  emptyBody: {
    color: theme.colors.muted,
    fontSize: theme.typography.sm,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    marginRight: 6,
  },
  legendLabel: { color: theme.colors.muted, fontSize: theme.typography.xs },
  scrollContent: { paddingBottom: theme.spacing.xxxl },
  headerIcon: { marginRight: theme.spacing.xs },
}))
