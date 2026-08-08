import { useCallback, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Check } from 'lucide-react-native'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import consentCopy from '@/src/content/consentDisclosure.json'
import { styles } from './index.styles'

export default function AnalyticsConsentScreen() {
  const { theme } = useUnistyles()
  const setAnalyticsAccepted = useConsentStore((s) => s.setAnalyticsAccepted)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)
  const { analytics } = consentCopy

  const handleContinue = useCallback(() => {
    setAnalyticsAccepted(analyticsEnabled)
    router.replace('/(home-tabs)')
  }, [setAnalyticsAccepted, analyticsEnabled])

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{analytics.title}</Text>
        <Text style={styles.body}>{analytics.intro}</Text>

        <Pressable
          onPress={() => setAnalyticsEnabled((v) => !v)}
          style={styles.analyticsRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: analyticsEnabled }}
          accessibilityLabel={`${analytics.label}: ${analytics.text}`}
        >
          <View
            style={[
              styles.checkbox,
              analyticsEnabled && styles.checkboxChecked,
            ]}
          >
            {analyticsEnabled && (
              <Check size={14} color={theme.colors.accentText} />
            )}
          </View>
          <Text style={styles.analyticsItemText}>
            <Text style={styles.itemLabel}>{analytics.label}</Text>{' '}
            {analytics.text}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleContinue}
          style={styles.continueBtn}
          accessibilityRole="button"
          accessibilityLabel={analytics.continueLabel}
        >
          <Text style={styles.continueText}>{analytics.continueLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
