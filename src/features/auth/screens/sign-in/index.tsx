import { showAlert } from '@/src/shared/hooks/useUIStore'
import { useCallback, useState } from 'react'
import { View, Text } from 'react-native'
import { router } from 'expo-router'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  FEDERATED_PROVIDERS,
  isFederatedProviderReleased,
  type FederatedProviderId,
} from '@/src/features/auth/lib/authProviders'
import { styles } from './index.styles'

// A user dismissing a provider sheet is not a failure — don't alert.
const isCancellation = (err: unknown) =>
  err instanceof Error && err.message === 'SIGN_IN_CANCELLED'

export default function SignInScreen() {
  const { signInWithEmail, signInWithProvider } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const advance = () => router.replace(nextConsentRoute())

  const handleEmailSignIn = useCallback(async () => {
    if (!email.trim() || !password) {
      showAlert('Missing details', 'Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await signInWithEmail(email.trim(), password)
      advance()
    } catch (err) {
      console.error('[sign-in] email failed:', err)
      showAlert(
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
        if (isCancellation(err)) return
        console.error(`[sign-in] ${providerId} failed:`, err)
        showAlert(
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
      <AmbientBackground />
      <View style={styles.content}>
        <Text style={styles.title}>FeralSpotter</Text>
        <Text style={styles.subtitle}>
          Sign in to start submitting cat observations.
        </Text>

        <View style={styles.fields}>
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            accessibilityLabel="Email"
          />
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            accessibilityLabel="Password"
          />
        </View>

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
          <TextButton
            onPress={() => router.push('/register')}
            accessibilityRole="link"
          >
            Create one
          </TextButton>
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
