import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { AppButton } from '@/src/components/atoms/AppButton'
import { useCallback, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { CheckIcon } from 'phosphor-react-native/src/icons/Check'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import consentCopy from '@/src/content/consentDisclosure.json'
import { styles } from './index.styles'

/**
 * Asks, before the analytics screen, whether the user wants email updates.
 * Unlike analytics, the box starts unchecked: email is opt-in, so pressing
 * Continue without a choice means "no".
 */
export default function EmailOptInScreen() {
  const { theme } = useUnistyles()
  const setEmailOptIn = useConsentStore((s) => s.setEmailOptIn)
  const [optedIn, setOptedIn] = useState(false)
  const { emailOptIn } = consentCopy

  const handleContinue = useCallback(() => {
    setEmailOptIn(optedIn)
    router.replace('/analytics-consent')
  }, [setEmailOptIn, optedIn])

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{emailOptIn.title}</Text>
        <Text style={styles.body}>{emailOptIn.intro}</Text>

        <Pressable
          onPress={() => setOptedIn((v) => !v)}
          style={styles.optInRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: optedIn }}
          accessibilityLabel={`${emailOptIn.label}: ${emailOptIn.text}`}
        >
          <View style={[styles.checkbox, optedIn && styles.checkboxChecked]}>
            {optedIn && (
              <CheckIcon
                size={theme.iconSize.sm}
                color={theme.colors.accentText}
              />
            )}
          </View>
          <Text style={styles.optInItemText}>
            <Text style={styles.itemLabel}>{emailOptIn.label}</Text>{' '}
            {emailOptIn.text}
          </Text>
        </Pressable>

        <View style={styles.continueRow}>
          <AppButton onPress={handleContinue}>
            {emailOptIn.continueLabel}
          </AppButton>
        </View>
      </ScrollView>
    </View>
  )
}
