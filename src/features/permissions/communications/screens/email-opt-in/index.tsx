import { ConsentChoiceScreen } from '@/src/features/permissions/consent/components/ConsentChoiceScreen'
import { router } from 'expo-router'
import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import { saveEmailOptIn } from '@/src/features/permissions/communications/hooks/saveEmailOptIn'
import { useAuthStore } from '@/src/features/auth/lib/authStore'
import consentCopy from '@/src/features/permissions/consent/content/consentDisclosure.json'
import { maskEmail } from '@/src/shared/utils/maskEmail'

/**
 * Asks, before the analytics screen, whether the user wants email updates.
 * Unlike analytics, the box starts unchecked: email is opt-in, so pressing
 * Continue without a choice means "no".
 */
export default function EmailOptInScreen() {
  const email = useAuthStore((s) => s.user?.email)

  return (
    <ConsentChoiceScreen
      copy={consentCopy.emailOptIn}
      defaultChecked={false}
      footnote={email ? `Updates go to ${maskEmail(email)}.` : undefined}
      onContinue={(checked) => {
        saveEmailOptIn(checked)
        router.replace(nextConsentRoute('/email-opt-in'))
      }}
    />
  )
}
