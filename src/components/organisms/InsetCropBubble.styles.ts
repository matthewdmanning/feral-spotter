import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  wrap: {
    position: 'absolute',
    zIndex: 3,
  },
  wrapTopCenter: {
    // Right-anchored like wrapBottomRight, not flex-centered — collapse now
    // needs a real edge to dock against (2026-08-07). Centering while
    // expanded is done with a computed translateX in the component instead.
    top: 0,
    right: theme.spacing.md,
  },
  wrapBottomRight: {
    // Clears annotate's bottomBar (paddingVertical 14 + nav-button content +
    // border), matching the #168 prototype's right:12/bottom:78 spacing.
    right: theme.spacing.md,
    bottom: 84,
  },
  bubble: {
    overflow: 'hidden',
    // Rounded square, not the #168 prototype's circular pill (regression
    // fix, #186) — a fixed corner radius, not diameter/2, so it stays a
    // square at any size instead of degenerating into a circle.
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  image: {
    position: 'absolute',
  },
}))
