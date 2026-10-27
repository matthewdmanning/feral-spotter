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

import '@/src/config/unistyles'
import { useUIStore } from '@/src/hooks'
import { AppProviders } from '@/src/providers/AppProviders'
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular'
import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium'
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold'
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold'
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold'
import { useFonts } from '@expo-google-fonts/nunito/useFonts'
import NetInfo from '@react-native-community/netinfo'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { useUnistyles } from 'react-native-unistyles'

// Hold the splash until Nunito loads, so the first frame does not draw in
// the system font and then jump. Keys are the `theme.fonts` family names.
SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const { theme } = useUnistyles()
  const setOnlineStatus = useUIStore((s) => s.setOnlineStatus)
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  })
  // A failed load falls back to the system font rather than blocking launch.
  const fontsSettled = fontsLoaded || fontError !== null

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) =>
      setOnlineStatus(s.isConnected ?? false),
    )
    return () => unsub()
  }, [setOnlineStatus])

  useEffect(() => {
    if (fontsSettled) SplashScreen.hideAsync().catch(() => {})
  }, [fontsSettled])

  if (!fontsSettled) return null

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerTitleStyle: {
            fontFamily: theme.fonts.bold,
            fontSize: theme.typography.lg,
            color: theme.colors.text,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      >
        {/* Tab group — headerShown false; each tab manages its own header */}
        <Stack.Screen name="(home-tabs)" options={{ headerShown: false }} />

        {/* Non-tab flows */}
        <Stack.Screen
          name="feral-reports"
          options={{ title: 'Feral Reports' }}
        />
        {/* Read-only past Sighting, from a Reports card or map pin */}
        <Stack.Screen name="report/[id]" options={{ title: 'Sighting' }} />
        <Stack.Screen
          name="intro-flow"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="sign-in"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="register" options={{ title: 'Create account' }} />
        <Stack.Screen
          name="email-opt-in"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="analytics-consent"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="consent"
          options={{
            title: 'Before You Start',
            gestureEnabled: false,
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="data-agreement"
          options={{ title: 'Data Usage Agreement' }}
        />

        <Stack.Screen
          name="camera"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
            headerShown: false,
            gestureEnabled: true,
          }}
        />

        {/* Submission nested Stack owns its own headers */}
        <Stack.Screen name="submission" options={{ headerShown: false }} />
      </Stack>
    </AppProviders>
  )
}
