import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  wrap: {
    position: 'absolute',
    zIndex: 3,
  },
  wrapTopRight: {
    top: 0,
    right: 0,
  },
  wrapBottomRight: {
    // Clears annotate's bottomBar (paddingVertical 14 + nav-button content +
    // border), matching the #168 prototype's right:12/bottom:78 spacing.
    right: theme.spacing.md,
    bottom: 84,
  },
  bubble: {
    overflow: 'hidden',
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
