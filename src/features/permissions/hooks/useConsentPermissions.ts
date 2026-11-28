/**
 * features/permissions/hooks/useConsentPermissions.ts
 * The data-collection disclosure's Agree action: record consent and move on.
 *
 * Agreeing asks for no OS permission. Camera and location are asked where
 * they are used: camera when the Camera screen opens, location when capture
 * can start (core/location/liveFix.ts). Photo library is asked by the
 * library picker. Apple asks apps to request access when people use the
 * feature, and not to require a system permission to use the app
 * (docs/references/consent-timing-best-practices.md).
 */

import { reportError } from '@/src/shared/analytics/analytics'
import { commonCopy, permissionCopy } from '@/src/shared/config/text'
import { routeAfterDeviceConsent } from '@/src/features/permissions/lib/deviceConsentRoute'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import { showAlert } from '@/src/shared/hooks/useUIStore'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'

export function useConsentPermissions() {
  const markAccepted = useConsentStore((s) => s.markAccepted)
  const [busy, setBusy] = useState(false)

  const handleAgree = useCallback(async () => {
    setBusy(true)
    try {
      markAccepted()
      router.replace(await routeAfterDeviceConsent())
    } catch (err) {
      reportError('[consent] continuing after agreement failed:', err)
      showAlert(commonCopy.somethingWentWrong, permissionCopy.saveFailedMessage)
    } finally {
      setBusy(false)
    }
  }, [markAccepted])

  return { busy, handleAgree }
}
