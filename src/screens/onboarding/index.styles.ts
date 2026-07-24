import { StyleSheet } from "react-native-unistyles";

export const styles = StyleSheet.create((theme, rt) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: rt.insets.top + theme.spacing.xxxl,
    paddingBottom: rt.insets.bottom + theme.spacing.lg,
  },
  slideContent: { flex: 1, justifyContent: "center" },
  header: {
    color: theme.colors.text,
    fontSize: theme.typography.xxxl,
    fontWeight: "700",
    lineHeight: theme.typography.xxxl * 1.2,
    marginBottom: theme.spacing.xl,
  },
  body: {
    color: theme.colors.muted,
    fontSize: theme.typography.base,
    lineHeight: theme.typography.base * 1.55,
    marginBottom: theme.spacing.md,
  },
  link: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    textDecorationLine: "underline",
    marginTop: theme.spacing.sm,
  },
  footer: { gap: theme.spacing.md },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border,
  },
  dotActive: { backgroundColor: theme.colors.accent },
}))
