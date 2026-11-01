import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  frame: {
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    borderWidth: theme.borderWidth.frame,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { position: 'absolute' },
}))
