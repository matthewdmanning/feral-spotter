import { useCallback, useState } from 'react'
import { View, Text, Alert } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '@/src/components/atoms/AppButton'
import { useAuth } from '@/src/lib/auth/useAuth'
import { styles } from './index.styles'

export default function SignInScreen() {
  const { signIn } = useAuth()
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = useCallback(async () => {
    setSigningIn(true)
    try {
      await signIn()
      router.replace('/analytics-consent')
    } catch (err) {
      console.error('[sign-in] failed:', err)
      Alert.alert('Sign-in failed', 'Something went wrong signing in. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }, [signIn])

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>FeralSpotter</Text>
        <Text style={styles.subtitle}>Sign in to start submitting cat observations.</Text>

        <View style={styles.button}>
          <AppButton onPress={handleSignIn} loading={signingIn} accessibilityLabel="Sign in with Google">
            Sign in with Google
          </AppButton>
        </View>
      </View>
    </View>
  )
}
