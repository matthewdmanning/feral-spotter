import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  inner: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  // zIndex lifts the zone's subtree, so a bubble dragged down over the form
  // draws above it instead of under it.
  headerZone: { position: 'relative', zIndex: 2 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { ...theme.textVariants.title, color: theme.colors.text },
  // The inset-crop bubble is centered over this title (#186) — fade it
  // significantly rather than trying to dodge the bubble positionally,
  // since the bubble can be wider than the available header row.
  titleFaded: { opacity: 0.15 },
  // Groups sit further apart than the items inside them: 16 + 8 = 24dp
  // (layout.sectionGap) above the actions, 12dp between them.
  actions: { gap: theme.layout.stackGap, marginTop: theme.spacing.sm },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
}))
