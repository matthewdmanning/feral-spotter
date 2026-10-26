import { ConsentChoiceScreen } from '@/src/components/organisms/ConsentChoiceScreen'
import { router } from 'expo-router'
import { nextConsentRoute } from '@/src/hooks/consentFlow'
import { useConsentStore } from '@/src/hooks/useConsentStore'
import consentCopy from '@/src/content/consentDisclosure.json'

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
