/**
 * features/permissions/consent/hooks/useConsentPermissions.ts
 * The consent gate's permission flow: request camera then location, record
 * consent only when both are usable, and re-check on return from the OS
 * Settings app while blocked.
 */

import consentCopy from '@/src/features/permissions/consent/content/consentDisclosure.json'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { showAlert } from '@/src/shared/hooks/useUIStore'
import { cameraPermission } from '@/src/features/permissions/photo/lib/cameraPermission'
import {
  isUsable as isLocationUsable,
  locationPermission,
} from '@/src/features/permissions/location/lib/locationPermission'
import * as Location from 'expo-location'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'

export function useConsentPermissions() {
  const markAccepted = useConsentStore((s) => s.markAccepted)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const handleAgree = useCallback(async () => {
    setBusy(true)
    try {
      // Requested sequentially, not via Promise.all: Android can only show one
      // permission dialog at a time, so firing both concurrently resolves
      // every request after the first as BLOCKED/denied without the user ever
      // seeing a prompt for it. Photo-library access (#91) is not requested
      // here — it's asked lazily at point of use by the library picker.
      const cameraGranted = await cameraPermission.request()
      const locationResponse =
        await Location.requestForegroundPermissionsAsync()

      if (!cameraGranted || !isLocationUsable(locationResponse)) {
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
        showAlert(
          consentCopy.locationOnceWarningTitle,
          consentCopy.locationOnceWarningBody,
        )
      }
      markAccepted()
      router.replace('/sign-in')
    } catch (err) {
      console.error('[consent] permission request failed:', err)
      showAlert(
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
      const cameraUsable = await cameraPermission.check()
      const locationUsable = await locationPermission.check()
      if (cameraUsable && locationUsable) {
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

  return { busy, blocked, handleAgree }
}
