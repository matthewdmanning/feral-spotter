import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  container: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  image: {
    position: 'absolute',
  },
}))
