import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  scroll: { backgroundColor: theme.colors.background },
  inner: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  headerZone: { position: 'relative' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.xxxl,
    fontWeight: '700',
  },
  // The inset-crop bubble is centered over this title (#186) — fade it
  // significantly rather than trying to dodge the bubble positionally,
  // since the bubble can be wider than the available header row.
  titleFaded: { opacity: 0.15 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  headerBtnText: { fontSize: theme.typography.sm, fontWeight: '500' },
}))
