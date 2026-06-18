import { BottomButtonColumn, type ColumnButton } from '@/src/components/molecules/BottomButtonColumn'
import { SignInPrompt } from '@/src/components/molecules/SignInPrompt'
import { useAuth } from '@/src/lib/auth/useAuth'
import { getAllSubmissionCaches } from '@/src/lib/cache/submissionCache'
import { isFirstLaunch, markLaunched } from '@/src/lib/firstLaunch'
import { Stack, router } from 'expo-router'
import { Camera, Settings } from 'lucide-react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BackHandler, Platform, Pressable, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

export default function HomeScreen() {
  const { theme } = useUnistyles()
  const { isAuthenticated, signIn } = useAuth()

  const [promptVisible, setPromptVisible] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  // First launch → register; otherwise show sign-in prompt if unauthenticated
  useEffect(() => {
    if (isFirstLaunch()) {
      markLaunched()
      router.replace('/register')
      return
    }
    if (!isAuthenticated) setPromptVisible(true)
  }, [])  // intentionally empty — runs once on mount

  // Android back — minimise (let Modal handle its own back)
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (promptVisible) return false
      return true
    })
    return () => sub.remove()
  }, [promptVisible])

  const handleSignIn = useCallback(async () => {
    setSigningIn(true)
    try {
      await signIn()
      setPromptVisible(false)
    } catch {
      // user cancelled — leave prompt open
    } finally {
      setSigningIn(false)
    }
  }, [signIn])

  const handleDismiss = useCallback(() => {
    if (signingIn) return
    setPromptVisible(false)
  }, [signingIn])

  const columnVisible = useMemo(() => {
    const caches = getAllSubmissionCaches()
    return caches.length > 0 && caches[0].status === 'In Progress'
  }, [])

  const handleCamera = useCallback(() => router.navigate('/camera'), [])
  const handleNew = useCallback(() => router.push('/submission/create'), [])
  const handleResume = useCallback(() => router.push('/submission/create'), [])
  const handleRegister = useCallback(() => router.push('/register'), [])

  const buttons = useMemo<ColumnButton[]>(() => [
    { key: 'resume', label: 'Resume Submission', onPress: handleResume, variant: 'primary' },
    { key: 'new', label: 'New Sighting', onPress: handleNew, variant: 'secondary' },
  ], [handleResume, handleNew])

  return (
    <>
      <Stack.Screen options={{
        headerShown: true, title: 'FeralSpotter',
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '700', color: theme.colors.text },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable onPress={() => router.push('/settings')} style={styles.headerIcon}
            accessibilityLabel="Open settings" accessibilityRole="button">
            <Settings size={22} color={theme.colors.text} />
          </Pressable>
        ),
      }} />

      <View style={styles.root}>
        <View style={styles.cameraArea}>
          <Pressable onPress={handleCamera} style={styles.cameraBtn}
            accessibilityLabel="Open camera" accessibilityRole="button">
            <Camera size={80} color={theme.colors.accentText} />
          </Pressable>
        </View>

        {/* Register — always visible, above the conditional column */}
        <Pressable onPress={handleRegister} style={styles.registerBtn}
          accessibilityLabel="Create an account" accessibilityRole="button">
          <Text style={styles.registerText}>Register</Text>
        </Pressable>

        <BottomButtonColumn
          buttons={buttons} visible={columnVisible} spacing={12} paddingBottom={16} />
      </View>

      <SignInPrompt
        visible={promptVisible} loading={signingIn}
        onSignIn={handleSignIn} onDismiss={handleDismiss}
      />
    </>
  )
}
