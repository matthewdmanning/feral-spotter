import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme, rt) => ({
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
    paddingHorizontal: theme.spacing.xl,
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
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
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
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
    zIndex: 25,
  },
  pillText: { ...theme.textVariants.label, color: theme.colors.text },
  autoA: {
    ...theme.textVariants.caption,
    position: 'absolute',
    bottom: theme.spacing.xs,
    right: theme.spacing.xs + 2,
    color: theme.colors.text,
    fontWeight: '800',
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
    backgroundColor: theme.colors.surface,
    ...theme.elevation.raised,
  },
  captureModeHint: {
    ...theme.textVariants.bodySmall,
    color: theme.colors.muted,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  strip: { height: 64 + 16, marginBottom: theme.spacing.xl },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xxxl + theme.spacing.md,
  },
  sideBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnFilled: {
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    ...theme.elevation.card,
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
  gate: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxxl,
    gap: theme.spacing.lg,
  },
  gateTitle: {
    ...theme.textVariants.heading,
    color: theme.colors.text,
    textAlign: 'center',
  },
  gateBody: {
    ...theme.textVariants.body,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  gateActions: {
    alignSelf: 'stretch',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
}))
