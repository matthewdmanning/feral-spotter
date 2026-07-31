import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  map: { flex: 1 },
  // Non-interactive overlay filling the map; centres the pin over the map's
  // centre coordinate.
  pinOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Shift the pin up by half its height so its tip (not centre) marks the spot.
  pin: { transform: [{ translateY: -20 }] },
  footer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  hint: {
    color: theme.colors.muted,
    fontSize: theme.typography.sm,
    textAlign: 'center',
  },
  buttonRow: { flexDirection: 'row', gap: theme.spacing.sm },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.md,
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
  setButton: { backgroundColor: theme.colors.accent },
  setButtonText: {
    color: theme.colors.accentText,
    fontSize: theme.typography.sm,
    fontWeight: '600',
  },
}))
