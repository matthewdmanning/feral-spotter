import { useCallback, useState } from 'react'
import { View, Text, TextInput, Alert } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '@/src/components/atoms/AppButton'
import { useAuth } from '@/src/lib/auth/useAuth'
import { styles } from './index.styles'

const MIN_PASSWORD_LENGTH = 6

export default function RegisterScreen() {
  const { registerWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const handleRegister = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Enter an email address.')
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        'Weak password',
        `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      return
    }
    if (password !== confirm) {
      Alert.alert(
        'Passwords do not match',
        'Re-enter the same password in both fields.',
      )
      return
    }
    setBusy(true)
    try {
      await registerWithEmail(email.trim(), password)
      router.replace('/analytics-consent')
    } catch (err) {
      console.error('[register] failed:', err)
      setBusy(false)
      Alert.alert(
        'Registration failed',
        'Could not create the account. Try a different email.',
      )
    }
  }, [email, password, confirm, registerWithEmail])

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Sign up with an email and password.</Text>

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
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          autoCapitalize="none"
          secureTextEntry
          accessibilityLabel="Confirm password"
        />

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
