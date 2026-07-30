import type { ColumnButton } from "@/src/components/atoms/AppButton";
import { BottomButtonColumn } from "@/src/components/molecules/BottomButtonColumn";
import { hasAcceptedConsent } from "@/src/hooks/useConsentStore";
import { useAuth } from "@/src/lib/auth/useAuth";
import { getAllSubmissionCaches } from "@/src/lib/cache/submissionCache";
import { Stack, router } from "expo-router";
import { Camera, Settings } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { styles } from "./index.styles";

export default function HomeScreen() {
  const { theme } = useUnistyles();
  const { isAuthenticated, isReady } = useAuth();

  // App-wide gate: unauthenticated → intro flow; authenticated but no device
  // consent → consent screen; otherwise render normal home. Never act while
  // !isReady — auth state is indeterminate until the provider has reported
  // at least once, and redirecting on a guess is what caused #93's loop.
  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/intro-flow");
    } else if (!hasAcceptedConsent()) {
      router.replace("/consent");
    }
  }, [isReady, isAuthenticated]);

  const [columnVisible, setColumnVisible] = useState(false);
  useEffect(() => {
    getAllSubmissionCaches().then((caches) => {
      setColumnVisible(caches.length > 0 && caches[0].status === "In Progress");
    });
  }, []);

  const handleCamera = useCallback(() => router.navigate("/camera"), []);
  const handleNew = useCallback(() => router.push("/submission/create"), []);
  const handleResume = useCallback(() => router.push("/submission/create"), []);

  const buttons = useMemo<ColumnButton[]>(
    () => [
      {
        key: "resume",
        label: "Resume Submission",
        onPress: handleResume,
        variant: "primary",
      },
      {
        key: "new",
        label: "New Sighting",
        onPress: handleNew,
        variant: "secondary",
      },
    ],
    [handleResume, handleNew],
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "FeralSpotter",
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: "700", color: theme.colors.text },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/settings")}
              style={styles.headerIcon}
              accessibilityLabel="Open settings"
              accessibilityRole="button"
            >
              <Settings size={22} color={theme.colors.text} />
            </Pressable>
          ),
        }}
      />

      <View style={styles.root}>
        <View style={styles.cameraArea}>
          <Pressable
            onPress={handleCamera}
            style={styles.cameraBtn}
            accessibilityLabel="Open camera"
            accessibilityRole="button"
          >
            <Camera size={80} color={theme.colors.accentText} />
          </Pressable>
        </View>

        <BottomButtonColumn
          buttons={buttons}
          visible={columnVisible}
          spacing={12}
          paddingBottom={16}
        />
      </View>
    </>
  );
}
