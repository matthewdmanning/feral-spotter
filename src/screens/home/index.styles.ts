import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
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
  },
  bottomArea: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  // #375: the reason a disabled entrypoint is disabled.
  disabledReason: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xxl,
  },
}))
