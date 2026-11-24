/**
 * features/permissions/hooks/useDataAgreementDecline.ts
 * NAV-1: the Data Agreement's decline rule before consent. Deny, or a
 * second Android Back, shows Consent's Decline warning and then leaves the
 * app. The first Back is ignored, so a stray press does not decline.
 */

import consentCopy from '@/src/features/permissions/copy/consentDisclosure.json'
import { confirmExitApp } from '@/src/shared/hooks/confirmExitApp'
import { useBackHandler } from '@/src/shared/hooks/useBackHandler'
import { hasAcceptedConsent } from '@/src/shared/consent/useConsentStore'
import { useCallback, useRef, useState } from 'react'

export function useDataAgreementDecline(): {
  canDeny: boolean
  deny: () => void
} {
  // Read once: accepting consent happens on another screen.
  const [canDeny] = useState(() => !hasAcceptedConsent())
  const backPresses = useRef(0)

  const deny = useCallback(
    () =>
      confirmExitApp(
        consentCopy.declineWarningTitle,
        consentCopy.declineWarningBody,
      ),
    [],
  )

  useBackHandler(
    useCallback(() => {
      if (!canDeny) return false
      backPresses.current += 1
      if (backPresses.current >= 2) deny()
      return true
    }, [canDeny, deny]),
  )

  return { canDeny, deny }
}
