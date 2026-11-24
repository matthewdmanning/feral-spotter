import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  photoLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  imageLayer: { flex: 1 },
  // Photo-overlay tokens (STYLE-7): the frame must read on any photo region.
  box: {
    borderWidth: theme.cropFrame.boxStroke,
    borderColor: theme.colors.onPhoto,
    boxShadow: `0 0 2px ${theme.colors.onPhotoHalo}, inset 0 0 2px ${theme.colors.onPhotoHalo}`,
    position: 'absolute',
  },
  // A recorded cat's box. Its color comes from the cat, set at render.
  previousBox: {
    position: 'absolute',
    borderWidth: theme.cropFrame.previousBoxStroke,
  },
  crosshairLine: {
    backgroundColor: theme.colors.onPhoto,
    boxShadow: `0 0 2px ${theme.colors.onPhotoHalo}`,
    opacity: theme.cropFrame.crosshairOpacity,
    position: 'absolute',
  },
  crosshairLineHorizontal: { height: theme.cropFrame.crosshairThickness },
  crosshairLineVertical: { width: theme.cropFrame.crosshairThickness },
  dotTouchArea: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: theme.cropFrame.dotSize,
    height: theme.cropFrame.dotSize,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
  },
  handleTouchArea: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleBar: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.full,
  },
  handleBarVertical: {
    width: theme.cropFrame.handleBarThickness,
    height: theme.cropFrame.handleBarLength,
  },
  handleBarHorizontal: {
    width: theme.cropFrame.handleBarLength,
    height: theme.cropFrame.handleBarThickness,
  },
  confirmWrap: {
    position: 'absolute',
    bottom: theme.spacing.xxl,
    alignSelf: 'center',
  },
}))
