import { StyleSheet } from 'react-native-unistyles'

// The fill only. The gradient is applied inline by AmbientBackground, since
// RN processes backgroundImage in JS.
export const styles = StyleSheet.create((theme) => ({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
}))
