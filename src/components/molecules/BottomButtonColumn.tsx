/**
 * components/molecules/BottomButtonColumn.tsx
 *
 * Unistyles v3 + Reanimated best practice:
 *   NEVER spread or merge Unistyles styles into useAnimatedStyle.
 *   Keep them in separate style props on the Animated.View:
 *     style={[styles.container, animatedStyle]}
 */
import type { ColumnButton } from "@/src/components/atoms/AppButton";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useUnistyles } from "react-native-unistyles";
import { styles } from "./BottomButtonColumn.styles";

interface BottomButtonColumnProps {
  buttons: ColumnButton[];
  visible: boolean;
  spacing?: number;
  paddingBottom?: number;
}

export function BottomButtonColumn({
  buttons,
  visible,
  spacing = 12,
  paddingBottom = 16,
}: BottomButtonColumnProps) {
  const { theme } = useUnistyles();

  // Reanimated SharedValues — UI thread animation
  const opacity = useSharedValue(visible ? 1 : 0);
  const scaleY = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const cfg = { duration: 220, easing: Easing.out(Easing.quad) };
    opacity.value = withTiming(visible ? 1 : 0, cfg);
    scaleY.value = withTiming(visible ? 1 : 0, cfg);
  }, [opacity, scaleY, visible]);

  // Reanimated style kept SEPARATE from Unistyles styles
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleY: scaleY.value }],
    overflow: "hidden",
    pointerEvents: opacity.value < 0.05 ? "none" : "auto",
  }));

  return (
    // [Unistyles style, Reanimated style] — never merged/spread together
    <Animated.View style={[styles.container, { paddingBottom }, animatedStyle]}>
      {buttons.map((btn, i) => {
        const variant = btn.variant ?? "primary";
        const bgMap = {
          primary: theme.colors.accent,
          secondary: theme.colors.surfaceAlt,
          ghost: "transparent",
          danger: "transparent",
        };
        const tcMap = {
          primary: theme.colors.accentText,
          secondary: theme.colors.text,
          ghost: theme.colors.muted,
          danger: theme.colors.danger,
        };
        const border =
          variant === "secondary"
            ? { borderWidth: 1, borderColor: theme.colors.border }
            : {};

        return (
          <View
            key={btn.key}
            style={i > 0 ? { marginTop: spacing } : undefined}
          >
            <Pressable
              onPress={btn.onPress}
              disabled={btn.disabled}
              style={[
                styles.btn,
                { backgroundColor: bgMap[variant] },
                border,
                btn.disabled && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={btn.accessibilityLabel ?? btn.label}
            >
              <Text style={[styles.label, { color: tcMap[variant] }]}>
                {btn.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </Animated.View>
  );
}
