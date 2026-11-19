import { showAlert } from '@/src/shared/hooks/useUIStore'
import { authCopy, commonCopy, formatCopy } from '@/src/shared/config/text'
import { useState } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { useAuthAttempt } from '@/src/features/auth/hooks/useAuthAttempt'
import { useAuth } from '@/src/features/auth/lib/useAuth'
import {
  FEDERATED_PROVIDERS,
  isFederatedProviderReleased,
  type FederatedProviderId,
} from '@/src/features/auth/lib/authProviders'
import { styles } from './index.styles'

export default function SignInScreen() {
  const { signInWithEmail, signInWithProvider } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { busy, attempt } = useAuthAttempt()

  const handleEmailSignIn = () => {
    if (!email.trim() || !password) {
      showAlert(authCopy.missingDetailsTitle, authCopy.missingDetailsMessage)
      return
    }
    void attempt(() => signInWithEmail(email.trim(), password), {
      tag: '[sign-in] email',
      title: authCopy.signInFailedTitle,
      message: authCopy.emailSignInFailedMessage,
    })
  }

  const handleFederated = (providerId: FederatedProviderId) =>
    void attempt(() => signInWithProvider(providerId), {
      tag: `[sign-in] ${providerId}`,
      title: authCopy.signInFailedTitle,
      message: authCopy.providerSignInFailedMessage,
    })

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{commonCopy.brand}</Text>
        <Text style={styles.subtitle}>{authCopy.signInSubtitle}</Text>

        <View style={styles.fields}>
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder={authCopy.email}
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            accessibilityLabel={authCopy.email}
          />
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder={authCopy.password}
            secureTextEntry
            accessibilityLabel={authCopy.password}
          />
        </View>

        <View style={styles.button}>
          <AppButton
            onPress={handleEmailSignIn}
            loading={busy}
            accessibilityLabel={authCopy.signIn}
          >
            {authCopy.signIn}
          </AppButton>
        </View>

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>{authCopy.noAccount} </Text>
          <TextButton
            onPress={() => router.push('/register')}
            accessibilityRole="link"
          >
            {authCopy.createOne}
          </TextButton>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{authCopy.divider}</Text>
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
                {released
                  ? provider.label
                  : formatCopy(authCopy.comingSoonTemplate, {
                      provider: provider.label,
                    })}
              </AppButton>
            </View>
          )
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
