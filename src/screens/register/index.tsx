import { showAlert } from '@/src/shared/hooks/useUIStore'
import { useCallback, useState } from 'react'
import { View, Text } from 'react-native'
import { router } from 'expo-router'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import { useAuth } from '@/src/lib/auth/useAuth'
import { validateRegistration } from '@/src/shared/utils/validation'
import { styles } from './index.styles'

export default function RegisterScreen() {
  const { registerWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const handleRegister = useCallback(async () => {
    const problem = validateRegistration(email, password, confirm)
    if (problem) {
      showAlert(problem.title, problem.message)
      return
    }
    setBusy(true)
    try {
      await registerWithEmail(email.trim(), password)
      router.replace(nextConsentRoute())
    } catch (err) {
      console.error('[register] failed:', err)
      setBusy(false)
      showAlert(
        'Registration failed',
        'Could not create the account. Try a different email.',
      )
    }
  }, [email, password, confirm, registerWithEmail])

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <View style={styles.content}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Sign up with an email and password.</Text>

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
          <TextField
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Confirm password"
            secureTextEntry
            accessibilityLabel="Confirm password"
          />
        </View>

        <View style={styles.button}>
          <AppButton
            onPress={handleRegister}
            loading={busy}
            accessibilityLabel="Create account"
          >
            Create account
          </AppButton>
        </View>
      </View>
    </View>
  )
}
