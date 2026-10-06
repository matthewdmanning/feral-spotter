import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  scroll: { backgroundColor: theme.colors.background },
  inner: {
    paddingHorizontal: theme.spacing.lg,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerBtn: {
    minHeight: theme.controlHeight.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  headerBtnText: { ...theme.textVariants.labelSmall },
}))
