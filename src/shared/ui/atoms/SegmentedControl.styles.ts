import { StyleSheet } from 'react-native-unistyles'

// A recessed, outlined track with a raised amber thumb on the selected
// option, rather than hard cells split by hairlines. Amber (`selection`),
// not the chartreuse action color: a chosen answer must not read as a
// button that does something.
export const styles = StyleSheet.create((theme) => ({
  container: { gap: theme.spacing.sm },
  // The category header outranks its options (heading vs. labelSmall).
  label: { ...theme.textVariants.heading, color: theme.colors.text },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceAlt,
    // Without an edge the track's fill sits too close to the card and reads
    // as a rendering glitch.
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    boxShadow: theme.depth.well,
  },
  // Base option — combined with selected/idle variant below
  option: {
    flex: 1,
    minHeight: theme.controlHeight.touchTarget,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Named variants for selected state — applied as array in JSX
  optionSelected: {
    backgroundColor: theme.colors.selection,
    boxShadow: theme.depth.raisedNeutral,
  },
  optionIdle: { backgroundColor: 'transparent' },
  optionPressed: {
    boxShadow: theme.depth.pressed,
    transform: [{ translateY: 1 }],
  },
  textSelected: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.selectionText,
    textAlign: 'center',
  },
  textIdle: {
    ...theme.textVariants.labelSmall,
    color: theme.colors.muted,
    textAlign: 'center',
  },
}))
