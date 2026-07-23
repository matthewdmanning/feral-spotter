import { useCallback, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { request, openSettings, RESULTS } from 'react-native-permissions'
import { useUnistyles } from 'react-native-unistyles'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { PERMISSION_MAP } from '@/src/lib/permissions'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import consentCopy from '@/src/content/consentDisclosure.json'
import { styles } from './index.styles'

export default function ConsentScreen() {
  const { theme } = useUnistyles()
  const markAccepted = useConsentStore((s) => s.markAccepted)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useBackHandler(useCallback(() => true, []))

  const handleAgree = useCallback(async () => {
    setBusy(true)
    try {
      const [cameraStatus, mediaStatus, locationStatus] = await Promise.all([
        request(PERMISSION_MAP.camera),
        request(PERMISSION_MAP.mediaLibrary),
        request(PERMISSION_MAP.location),
      ])
      markAccepted()

      if (
        cameraStatus === RESULTS.BLOCKED ||
        mediaStatus === RESULTS.BLOCKED ||
        locationStatus === RESULTS.BLOCKED
      ) {
        setBlocked(true)
        return
      }
      router.replace('/(home-tabs)')
    } finally {
      setBusy(false)
    }
  }, [markAccepted])

  const handleContinueWithoutAccess = useCallback(() => {
    router.replace('/(home-tabs)')
  }, [])

  if (blocked) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Permission Blocked</Text>
        <Text style={styles.gateBody}>
          Camera, photo, or location access was denied. You can enable it later in Settings, or
          continue without it — you&apos;ll be asked again when the app needs it.
        </Text>
        <Pressable
          onPress={() => openSettings()}
          style={styles.gatePrimary}
          accessibilityRole="button"
        >
          <Text style={styles.gatePrimaryText}>Open Settings</Text>
        </Pressable>
        <Pressable
          onPress={handleContinueWithoutAccess}
          style={styles.gateSecondary}
          accessibilityRole="button"
        >
          <Text style={styles.gateSecondaryText}>Continue Without Access</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{consentCopy.title}</Text>
        <Text style={styles.body}>{consentCopy.intro}</Text>
        {consentCopy.items.map((item) => (
          <Text key={item.label} style={styles.item}>
            <Text style={styles.itemLabel}>{item.label}</Text> {item.text}
          </Text>
        ))}
        {consentCopy.body.map((paragraph) => (
          <Text key={paragraph} style={styles.body}>{paragraph}</Text>
        ))}

        <Pressable
          onPress={handleAgree} disabled={busy}
          style={[styles.agreeBtn, busy && styles.agreeBusy]}
          accessibilityRole="button" accessibilityLabel={consentCopy.agreeLabel}
        >
          {busy
            ? <ActivityIndicator color={theme.colors.accentText} />
            : <Text style={styles.agreeText}>{consentCopy.agreeLabel}</Text>
          }
        </Pressable>
      </ScrollView>
    </View>
  )
}
