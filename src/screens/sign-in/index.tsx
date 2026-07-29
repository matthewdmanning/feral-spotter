import { useCallback, useState } from 'react'
import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '@/src/components/atoms/AppButton'
import { useAuth } from '@/src/lib/auth/useAuth'
import {
  FEDERATED_PROVIDERS,
  isFederatedProviderReleased,
  type FederatedProviderId,
} from '@/src/lib/auth/authProviders'
import { styles } from './index.styles'

export default function SignInScreen() {
  const { signInWithEmail, signInWithProvider } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const advance = () => router.replace('/analytics-consent')

  const handleEmailSignIn = useCallback(async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await signInWithEmail(email.trim(), password)
      advance()
    } catch (err) {
      console.error('[sign-in] email failed:', err)
      Alert.alert(
        'Sign-in failed',
        'Check your email and password, then try again.',
      )
    } finally {
      setBusy(false)
    }
  }, [email, password, signInWithEmail])

  const handleFederated = useCallback(
    async (providerId: FederatedProviderId) => {
      setBusy(true)
      try {
        await signInWithProvider(providerId)
        advance()
      } catch (err) {
        console.error(`[sign-in] ${providerId} failed:`, err)
        Alert.alert(
          'Sign-in failed',
          'Something went wrong signing in. Please try again.',
        )
      } finally {
        setBusy(false)
      }
    },
    [signInWithProvider],
  )

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>FeralSpotter</Text>
        <Text style={styles.subtitle}>
          Sign in to start submitting cat observations.
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          accessibilityLabel="Email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          autoCapitalize="none"
          secureTextEntry
          accessibilityLabel="Password"
        />

        <View style={styles.button}>
          <AppButton
            onPress={handleEmailSignIn}
            loading={busy}
            accessibilityLabel="Sign in"
          >
            Sign in
          </AppButton>
        </View>

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>No account? </Text>
          <Pressable
            onPress={() => router.push('/register')}
            accessibilityRole="link"
          >
            <Text style={styles.registerLink}>Create one</Text>
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {FEDERATED_PROVIDERS.map((provider) => {
          const released = isFederatedProviderReleased(provider)
          return (
            <View key={provider.id} style={styles.providerButton}>
              <AppButton
                variant="secondary"
                disabled={!released || busy}
                onPress={() => handleFederated(provider.id)}
                accessibilityLabel={provider.label}
              >
                {released ? provider.label : `${provider.label} (coming soon)`}
              </AppButton>
            </View>
          )
        })}
      </View>
    </View>
  )
}
