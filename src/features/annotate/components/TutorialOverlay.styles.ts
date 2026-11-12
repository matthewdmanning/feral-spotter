import { StyleSheet } from 'react-native-unistyles'

// Keeps the card above the annotate screen's bottom action row.
const BOTTOM_ACTIONS_CLEARANCE = 100
// Skip is a 48dp text button; the card starts below it.
const SKIP_BUTTON_HEIGHT = 48

export const styles = StyleSheet.create((theme, rt) => ({
  // Rendered inside RN's Modal, full-bleed over the annotate screen — the
  // fixed top: 56 / paddingBottom: 100 below used to happen to clear the
  // status bar and gesture bar rather than actually accounting for them.
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: rt.insets.bottom + BOTTOM_ACTIONS_CLEARANCE,
    paddingTop: rt.insets.top + theme.spacing.md * 2 + SKIP_BUTTON_HEIGHT,
  },
  skipBtn: {
    position: 'absolute',
    top: rt.insets.top + theme.spacing.md,
    right: theme.layout.gutter,
    paddingHorizontal: theme.spacing.md,
  },
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.xxl,
    width: '100%',
    maxWidth: 360,
    maxHeight: '100%',
  },
  cardScroll: { flexGrow: 0 },
  cardContent: { gap: theme.spacing.md },
  counter: { ...theme.textVariants.caption, color: theme.colors.highlight },
  title: { ...theme.textVariants.heading, color: theme.colors.text },
  body: { ...theme.textVariants.body, color: theme.colors.muted },
}))
