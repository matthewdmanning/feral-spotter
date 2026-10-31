import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // No horizontal padding — the buffer around the circular entrypoint
  // buttons is computed from the screen edge (see HomeScreen's
  // entrypointBuffer), not a fixed inset.
  entrypointArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    // Floor for the space between the two circles. space-evenly alone
    // lets it shrink on short screens.
    gap: theme.spacing.md,
    paddingTop: rt.insets.top,
  },
  bottomArea: {
    paddingHorizontal: theme.layout.gutter,
    paddingBottom: theme.spacing.lg,
  },
}))
