import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  AppState,
  BackHandler,
  Linking,
  Platform,
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import {
  VisionCamera,
  type PermissionStatus as CameraPermissionStatus,
} from 'react-native-vision-camera'
import { useUnistyles } from 'react-native-unistyles'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import consentCopy from '@/src/content/consentDisclosure.json'
import { styles } from './index.styles'

// Used by the foreground-recheck path only — handleAgree reads the boolean
// requestCameraPermission() itself resolves with instead (see comment
// there). react-native-vision-camera reports a first-time "Don't allow" as
// 'not-determined' (still askable), not 'denied' — Android only escalates to
// 'denied' on a second denial (or "don't ask again"). 'not-determined' must
// gate too or a first-time full denial bypasses the gate entirely (#66,
// #237 — ported from react-native-permissions's identical DENIED/BLOCKED
// split). 'restricted' (e.g. parental controls) gates too — the camera isn't
// usable without it either way.
function isCameraGated(status: CameraPermissionStatus) {
  return status !== 'authorized'
}

// expo-location's `granted` alone isn't enough on Android: choosing
// "Approximate" still resolves granted === true, just with
// `android.accuracy === 'coarse'` — that must gate the same way
// Approximate reading as BLOCKED did under react-native-permissions (#66),
// since a Submission needs a Live fix accurate enough to be usable.
// `ios.accuracy === 'reduced'` intentionally does NOT gate — it didn't
// under the old LIMITED status either, and reduced iOS access is a real,
// working state, unlike Android's coarse-only grant.
function isLocationGated(response: Location.LocationPermissionResponse) {
  return (
    !response.granted ||
    (Platform.OS === 'android' && response.android?.accuracy !== 'fine')
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
      // Read the boolean `requestCameraPermission()` itself resolves with,
      // rather than re-reading `cameraPermissionStatus` right after — not
      // relying on the native getter having settled by the time the promise
      // resolves. The getter is used for the foreground-recheck path below,
      // where there's no request in flight and it's the only source of truth.
      const cameraGranted = await VisionCamera.requestCameraPermission()
      const locationResponse =
        await Location.requestForegroundPermissionsAsync()

      if (!cameraGranted || isLocationGated(locationResponse)) {
        // Consent isn't recorded on a gated outcome (#66) — a relaunch while
        // still blocked must land back on this screen and re-request, not
        // read as "already consented" and skip straight past the gate.
        setBlocked(true)
        return
      }
      // Neither react-native-permissions nor expo-location can distinguish
      // Android's "Only this time" from "While using the app" location
      // choices — expo-location's `expires` field is hardcoded to `'never'`
      // for every Android grant, not just one-time ones — so the notice
      // fires on every fresh grant and is worded conditionally ("if you
      // chose...") rather than claiming to know which one the user picked
      // (#225).
      if (Platform.OS === 'android' && locationResponse.granted) {
        Alert.alert(
          consentCopy.locationOnceWarningTitle,
          consentCopy.locationOnceWarningBody,
        )
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
      const cameraStatus = VisionCamera.cameraPermissionStatus
      const locationResponse = await Location.getForegroundPermissionsAsync()
      if (!isCameraGated(cameraStatus) && !isLocationGated(locationResponse)) {
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
          onPress={() => Linking.openSettings()}
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
