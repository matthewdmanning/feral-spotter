import { StyleSheet } from 'react-native-unistyles'
import {
  THUMB_GAP,
  THUMB_SIZE,
} from '@/src/features/camera-control/components/CameraThumb.constants'

export const styles = StyleSheet.create((theme, rt) => {
  // Controls over the live preview are solid surface colour, never glass:
  // glass captures its backdrop with a software draw, and the camera
  // preview (a SurfaceView/TextureView) refuses it, so the glass would
  // freeze on a stale frame. Solid surface + text colour keeps the theme's
  // contrast pair on any scene.
  const cameraChip = {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  }

  return {
    root: { flex: 1, backgroundColor: theme.colors.cameraBackground },
    // The preview is the only in-flow child of root -- the chrome, the flash
    // overlay and the thumbnail strip are all absolutely positioned -- so flex
    // fills the screen. It must not use absolute insets: the native camera view
    // resolves `position: absolute` with all four insets to full width and zero
    // height, which left the preview blank while the session streamed normally.
    cameraFill: { flex: 1 },
    flashOverlay: { backgroundColor: theme.colors.flashEffect, zIndex: 10 },
    topBar: {
      position: 'absolute',
      top: rt.insets.top + theme.spacing.md,
      left: 0,
      right: 0,
      zIndex: 20,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.layout.gutter,
    },
    topBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    iconBtn: {
      // 48x48dp — Android Material touch-target minimum (ux_principles.md #1);
      // 44 (iOS HIG minimum) was under it on Android.
      width: theme.controlHeight.touchTarget,
      height: theme.controlHeight.touchTarget,
      borderRadius: theme.radius.full,
      ...cameraChip,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 25,
    },
    pill: {
      minHeight: theme.controlHeight.touchTarget,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.full,
      ...cameraChip,
      zIndex: 25,
    },
    pillText: { ...theme.textVariants.label, color: theme.colors.text },
    autoA: {
      ...theme.textVariants.caption,
      position: 'absolute',
      bottom: theme.spacing.xs,
      right: theme.spacing.xs + 2,
      color: theme.colors.text,
      fontFamily: theme.fonts.extrabold,
    },
    bottomBar: {
      position: 'absolute',
      // Mirrors topBar's `rt.insets.top + 12` — the shutter row was flush
      // against the raw screen edge with no safe-area/gesture-nav clearance.
      bottom: rt.insets.bottom + theme.spacing.lg,
      left: 0,
      right: 0,
      zIndex: 20,
    },
    captureModeControl: {
      marginHorizontal: theme.spacing.xxxl,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.xl,
      ...cameraChip,
    },
    captureModeHint: {
      ...theme.textVariants.bodySmall,
      color: theme.colors.muted,
      marginTop: theme.spacing.sm,
      textAlign: 'center',
    },
    strip: {
      height: THUMB_SIZE + theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    stripContent: { paddingHorizontal: theme.layout.gutter, gap: THUMB_GAP },
    shutterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.xxxl + theme.spacing.md,
    },
    sideBtn: {
      width: theme.controlHeight.control,
      height: theme.controlHeight.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideBtnFilled: {
      borderRadius: theme.radius.full,
      ...cameraChip,
      zIndex: 25,
    },
    // Ring and core both use the on-camera color: they sit on the live feed,
    // where a dark core in light mode would vanish against a dark scene.
    shutter: {
      width: 78,
      height: 78,
      borderRadius: theme.radius.full,
      borderWidth: 4,
      borderColor: theme.colors.onCamera,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 25,
    },
    shutterBusy: { opacity: 0.5 },
    shutterInner: {
      width: 62,
      height: 62,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.onCamera,
    },
  }
})
