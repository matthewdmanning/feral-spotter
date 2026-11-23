import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create((theme) => ({
  map: {
    height: theme.layout.mapHeight,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  fill: { flex: 1 },
  photo: { height: theme.layout.photoPreviewHeight, width: '100%' },
}))
