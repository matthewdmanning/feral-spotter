import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  box: {
    width: theme.iconSize.lg,
    height: theme.iconSize.lg,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
}))
