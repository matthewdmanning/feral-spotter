import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  wrap: {
    position: 'absolute',
    zIndex: 3,
  },
  wrapTopCenter: {
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
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
