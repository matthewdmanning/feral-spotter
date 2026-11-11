import { useHeaderHeight } from 'expo-router/react-navigation'
import { showAlert } from '@/src/shared/hooks/useUIStore'
import { useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { useAuthAttempt } from '@/src/features/auth/hooks/useAuthAttempt'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import { validateRegistration } from '@/src/shared/utils/validation'
import { styles } from './index.styles'

export default function RegisterScreen() {
  const headerHeight = useHeaderHeight()
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
