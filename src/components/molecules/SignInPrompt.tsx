/**
 * components/molecules/SignInPrompt.tsx
 *
 * Bottom-sheet modal prompting the user to sign in.
 * Dismissible via:
 *   - "Sign in Later" button
 *   - Tap outside (backdrop press)
 *   - Android back gesture (Modal onRequestClose)
 */

import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './SignInPrompt.styles'

interface SignInPromptProps {
  visible:     boolean
  loading:     boolean
  onSignIn:    () => void
  onDismiss:   () => void
}

export function SignInPrompt({ visible, loading, onSignIn, onDismiss }: SignInPromptProps) {
  const { theme } = useUnistyles()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}   // Android back gesture
      statusBarTranslucent
    >
      {/* Backdrop — tap to dismiss */}
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Stop propagation so taps on the sheet don't dismiss */}
        <Pressable onPress={() => {}}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Sign in to FeralSpotter</Text>
            <Text style={styles.body}>
              Sign in to submit cat observations. You can explore the app
              without an account.
            </Text>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.colors.muted} />
                <Text style={styles.loadingText}>Signing in…</Text>
              </View>
            ) : (
              <Pressable
                onPress={onSignIn}
                style={styles.signInBtn}
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
              >
                <Text style={styles.signInText}>Sign in with Google</Text>
              </Pressable>
            )}

            <Pressable
              onPress={onDismiss}
              style={styles.laterBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign in later"
              disabled={loading}
            >
              <Text style={styles.laterText}>Sign in Later</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
