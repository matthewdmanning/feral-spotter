/**
 * app/_layout.tsx — Root layout.
 * Routes only decide when screens are shown.
 * All providers live in providers/AppProviders.
 *
 * Flow: (home-tabs) → camera (modal) → submission (nested Stack)
 *
 * useUnistyles with Stack is explicitly allowed by Unistyles —
 * react-navigation does not re-render screens on screenOptions changes.
 */

import "@/src/config/unistyles";
import { useUIStore } from "@/src/hooks";
import { AppProviders } from "@/src/providers/AppProviders";
import NetInfo from "@react-native-community/netinfo";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { useUnistyles } from "react-native-unistyles";

export default function RootLayout() {
  const { theme } = useUnistyles();
  const setOnlineStatus = useUIStore((s) => s.setOnlineStatus);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) =>
      setOnlineStatus(s.isConnected ?? false),
    );
    return () => unsub();
  }, [setOnlineStatus]);

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: "700", color: theme.colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: "slide_from_right",
          gestureEnabled: true,
        }}
      >
        {/* Tab group — headerShown false; each tab manages its own header */}
        <Stack.Screen name="(home-tabs)" options={{ headerShown: false }} />

        {/* Non-tab flows */}
        <Stack.Screen
          name="feral-reports"
          options={{ title: "Feral Reports" }}
        />
        <Stack.Screen
          name="register"
          options={{ title: "Create Account", headerBackTitle: "" }}
        />

        <Stack.Screen
          name="camera"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
            headerShown: false,
            gestureEnabled: false,
          }}
        />

        {/* Submission nested Stack owns its own headers */}
        <Stack.Screen name="submission" options={{ headerShown: false }} />
      </Stack>
    </AppProviders>
  );
}
