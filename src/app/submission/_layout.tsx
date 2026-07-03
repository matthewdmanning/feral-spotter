/**
 * Submission Layout — nested Stack
 * Linear flow: create → cats → photos
 * annotate: fullScreenModal (opened from cats)
 */

import { ErrorBoundary } from "@/src/components/atoms/ErrorBoundary";
import { Stack, router } from "expo-router";
import { Settings } from "lucide-react-native";
import { Pressable } from "react-native";
import { useUnistyles } from "react-native-unistyles";

const STEPS = ["create", "cats", "photos"] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLES: Record<Step, string> = {
  create: "Submission Details",
  cats: "Cat Observations",
  photos: "Photos",
};

export default function SubmissionLayout() {
  // useUnistyles with Stack is explicitly allowed — react-navigation
  // does not re-render screens on style prop changes.
  const { theme } = useUnistyles();

  const HeaderRight = () => (
    <Pressable
      onPress={() => router.push("/settings")}
      accessibilityLabel="Open settings"
      accessibilityRole="button"
      style={{ marginRight: 4 }}
    >
      <Settings size={22} color={theme.colors.text} />
    </Pressable>
  );

  return (
    <ErrorBoundary>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: "700", color: theme.colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: "slide_from_right",
          gestureEnabled: true,
          headerRight: () => <HeaderRight />,
        }}
      >
        {STEPS.map((step) => (
          <Stack.Screen
            key={step}
            name={step}
            options={{
              title: STEP_TITLES[step],
              headerBackTitle: "",
              headerRight: () => null, // step indicator: ${STEP_NUMBER[step]} / ${STEPS.length}
            }}
          />
        ))}

        <Stack.Screen
          name="annotate"
          options={{
            title: "Locate Cat",
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>
    </ErrorBoundary>
  );
}
