import { showAlert } from '@/src/hooks/useUIStore'
import { useState } from 'react'
import { View, Text } from 'react-native'
import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { AppButton } from '@/src/components/atoms/AppButton'
import { TextField } from '@/src/components/atoms/TextField'
import { useAuthAttempt } from '@/src/hooks/useAuthAttempt'
import { useAuth } from '@/src/lib/auth/useAuth'
import { validateRegistration } from '@/src/utils/validation'
import { styles } from './index.styles'

export default function RegisterScreen() {
  const { registerWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const { busy, attempt } = useAuthAttempt()

  const handleRegister = () => {
    const problem = validateRegistration(email, password, confirm)
    if (problem) {
      showAlert(problem.title, problem.message)
      return
    }
    void attempt(() => registerWithEmail(email.trim(), password), {
      tag: '[register]',
      title: 'Registration failed',
      message: 'Could not create the account. Try a different email.',
    })
  }

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
