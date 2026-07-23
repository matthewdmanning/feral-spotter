import { useCallback, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { request, openSettings, RESULTS } from 'react-native-permissions'
import { useUnistyles } from 'react-native-unistyles'
import { markConsentAccepted } from '@/src/lib/consent'
import { PERMISSION_MAP } from '@/src/lib/permissions'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import { styles } from './index.styles'

export default function ConsentScreen() {
  const { theme } = useUnistyles()
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useBackHandler(useCallback(() => true, []))

  const handleAgree = useCallback(async () => {
    setBusy(true)
    try {
      const [cameraStatus, mediaStatus] = await Promise.all([
        request(PERMISSION_MAP.camera),
        request(PERMISSION_MAP.mediaLibrary),
      ])
      await markConsentAccepted()

      if (cameraStatus === RESULTS.BLOCKED || mediaStatus === RESULTS.BLOCKED) {
        setBlocked(true)
        return
      }
      router.replace('/(home-tabs)')
    } finally {
      setBusy(false)
    }
  }, [])

  const handleContinueWithoutAccess = useCallback(() => {
    router.replace('/(home-tabs)')
  }, [])

  if (blocked) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Permission Blocked</Text>
        <Text style={styles.gateBody}>
          Camera or photo access was denied. You can enable it later in Settings, or continue
          without it — you&apos;ll be asked again when you try to use the camera.
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
        <Text style={styles.title}>Before you start</Text>
        <Text style={styles.body}>
          FeralSpotter collects the following each time you submit a sighting:
        </Text>
        <Text style={styles.item}><Text style={styles.itemLabel}>Photos</Text> you take of the animal</Text>
        <Text style={styles.item}><Text style={styles.itemLabel}>Location</Text> (GPS) where the sighting occurred</Text>
        <Text style={styles.item}><Text style={styles.itemLabel}>Details you enter</Text> about the animal (appearance, condition, etc.)</Text>
        <Text style={styles.item}><Text style={styles.itemLabel}>Your Google account</Text>, so we can follow up if a submission needs clarification</Text>
        <Text style={styles.body}>
          This data is uploaded to a private cloud storage bucket and used to build a dataset for
          feral cat population tracking and research. It is not made public and is not shared
          outside this project.
        </Text>
        <Text style={styles.body}>
          By continuing, you agree to this data being collected and uploaded when you submit a sighting.
        </Text>

        <Pressable
          onPress={handleAgree} disabled={busy}
          style={[styles.agreeBtn, busy && styles.agreeBusy]}
          accessibilityRole="button" accessibilityLabel="I Agree — Continue"
        >
          {busy
            ? <ActivityIndicator color={theme.colors.accentText} />
            : <Text style={styles.agreeText}>I Agree — Continue</Text>
          }
        </Pressable>
      </ScrollView>
    </View>
  )
}
