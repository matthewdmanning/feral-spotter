import { ConsentChoiceScreen } from '@/src/features/permissions/consent/components/ConsentChoiceScreen'
import { router } from 'expo-router'
import { nextConsentRoute } from '@/src/shared/consent/consentFlow'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import consentCopy from '@/src/features/permissions/consent/content/consentDisclosure.json'

export default function AnalyticsConsentScreen() {
  const setAnalyticsAccepted = useConsentStore((s) => s.setAnalyticsAccepted)

  return (
    <ConsentChoiceScreen
      copy={consentCopy.analytics}
      defaultChecked
      onContinue={(checked) => {
        setAnalyticsAccepted(checked)
        router.replace(nextConsentRoute('/analytics-consent'))
      }}
    />
  )
}
