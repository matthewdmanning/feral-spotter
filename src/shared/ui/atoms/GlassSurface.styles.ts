import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  // When glass cannot draw: the theme's own surface, with a hairline edge
  // to keep it apart from the page, the same job the glass rim does.
  fallback: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
}))
