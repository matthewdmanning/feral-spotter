import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  AppState,
  BackHandler,
  Platform,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { check, request, openSettings, RESULTS } from 'react-native-permissions'
import { useUnistyles } from 'react-native-unistyles'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { PERMISSION_MAP } from '@/src/lib/permissions'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import consentCopy from '@/src/content/consentDisclosure.json'
import { styles } from './index.styles'

// react-native-permissions reports a first-time "Don't allow" as DENIED, not
// BLOCKED — Android only escalates to BLOCKED on a second denial (or
// "don't ask again"). Location's Approximate accuracy choice already reads
// as BLOCKED on the first denial and gates correctly; DENIED must gate too
// or a first-time full denial bypasses the gate entirely (#66). UNAVAILABLE
// (the permission/feature doesn't exist on this device) gates too — neither
// permission is usable without it, same as BLOCKED/DENIED. Applies equally
// to camera — its first-time "Don't allow" has the same DENIED-not-BLOCKED
// asymmetry, just never tested/fixed alongside location's (#237).
function isPermissionGated(status: string) {
  return (
    status === RESULTS.BLOCKED ||
    status === RESULTS.DENIED ||
    status === RESULTS.UNAVAILABLE
  )
}

export default function ConsentScreen() {
  const { theme } = useUnistyles()
  const markAccepted = useConsentStore((s) => s.markAccepted)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useBackHandler(useCallback(() => true, []))

  const handleAgree = useCallback(async () => {
    setBusy(true)
    try {
      // Requested sequentially, not via Promise.all: Android can only show one
      // permission dialog at a time, so firing both concurrently resolves
      // every request after the first as BLOCKED/denied without the user ever
      // seeing a prompt for it. Photo-library access (#91) is not requested
      // here — it's asked lazily at point of use by the library picker.
      const cameraStatus = await request(PERMISSION_MAP.camera)
      const locationStatus = await request(PERMISSION_MAP.location)

      if (
        isPermissionGated(cameraStatus) ||
        isPermissionGated(locationStatus)
      ) {
        // Consent isn't recorded on a gated outcome (#66) — a relaunch while
        // still blocked must land back on this screen and re-request, not
        // read as "already consented" and skip straight past the gate.
        setBlocked(true)
        return
      }
      markAccepted()
      router.replace('/sign-in')
    } catch (err) {
      console.error('[consent] permission request failed:', err)
      Alert.alert(
        'Something went wrong',
        'Could not process permissions. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }, [markAccepted])

  // Manually granting in system Settings and returning to the app doesn't
  // trigger a re-request — re-check on foreground so the gate clears once
  // access is actually there instead of trapping the user behind it.
  useEffect(() => {
    if (!blocked) return

    const recheck = async () => {
      const [cameraStatus, locationStatus] = await Promise.all([
        check(PERMISSION_MAP.camera),
        check(PERMISSION_MAP.location),
      ])
      if (
        !isPermissionGated(cameraStatus) &&
        !isPermissionGated(locationStatus)
      ) {
        setBlocked(false)
        markAccepted()
        router.replace('/sign-in')
      }
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheck()
    })
    return () => sub.remove()
  }, [blocked, markAccepted])

  const handleDecline = useCallback(() => {
    Alert.alert(
      consentCopy.declineWarningTitle,
      consentCopy.declineWarningBody,
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            // iOS has no supported way to self-terminate — Back is the only
            // option there; Exit only does anything on Android.
            if (Platform.OS === 'android') BackHandler.exitApp()
          },
        },
      ],
    )
  }, [])

  if (blocked) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Permission Blocked</Text>
        <Text style={styles.gateBody}>
          Camera, photo, or location access was denied. Enable it in Settings to
          continue — you&apos;ll be brought back here automatically once
          it&apos;s granted.
        </Text>
        <Pressable
          onPress={() => openSettings()}
          style={styles.gatePrimary}
          accessibilityRole="button"
        >
          <Text style={styles.gatePrimaryText}>Open Settings</Text>
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
          <Text key={paragraph} style={styles.body}>
            {paragraph}
          </Text>
        ))}

        <Pressable
          onPress={handleAgree}
          disabled={busy}
          style={[styles.agreeBtn, busy && styles.agreeBusy]}
          accessibilityRole="button"
          accessibilityLabel={consentCopy.agreeLabel}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.accentText} />
          ) : (
            <Text style={styles.agreeText}>{consentCopy.agreeLabel}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleDecline}
          disabled={busy}
          style={styles.declineBtn}
          accessibilityRole="button"
          accessibilityLabel={consentCopy.declineLabel}
        >
          <Text style={styles.declineText}>{consentCopy.declineLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
