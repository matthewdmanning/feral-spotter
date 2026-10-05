import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
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
  pin: { transform: [{ translateY: -theme.iconSize.xxl / 2 }] },
  // Not scrollable, no header below it — pinned above the gesture bar.
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: rt.insets.bottom + theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    // Lift the sheet over the map, and pull it up so its rounded corners
    // sit over map content rather than over an empty strip.
    marginTop: -theme.radius.xxl,
    ...theme.elevation.raised,
  },
  hint: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  buttonRow: { flexDirection: 'row', gap: theme.spacing.sm },
  button: {
    minHeight: theme.controlHeight.control,
    justifyContent: 'center',
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  cancelButtonText: { ...theme.textVariants.label, color: theme.colors.text },
  setButton: { backgroundColor: theme.colors.accent },
  setButtonText: {
    ...theme.textVariants.label,
    color: theme.colors.accentText,
  },
}))
