import { StyleSheet } from "react-native-unistyles";

export const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: rt.insets.top + theme.spacing.xxl,
    paddingBottom: rt.insets.bottom + theme.spacing.lg,
  },
  scrollContent: { paddingBottom: theme.spacing.xl },
  deniedContent: { flex: 1, justifyContent: "center" },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.xxl,
  },
  header: {
    color: theme.colors.text,
    fontSize: theme.typography.xxl,
    fontWeight: "700",
    lineHeight: theme.typography.xxl * 1.25,
    marginBottom: theme.spacing.lg,
  },
  body: {
    color: theme.colors.muted,
    fontSize: theme.typography.sm,
    lineHeight: theme.typography.sm * 1.55,
    marginBottom: theme.spacing.md,
  },
  buttons: { gap: theme.spacing.sm },
}))
