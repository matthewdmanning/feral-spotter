import { ConsentChoiceScreen } from '@/src/features/permissions/components/ConsentChoiceScreen'
import { continueConsentChain } from '@/src/shared/consent/consentFlow'
import { useConsentStore } from '@/src/shared/consent/useConsentStore'
import consentCopy from '@/src/features/permissions/copy/consentDisclosure.json'

export default function AnalyticsConsentScreen() {
  const setAnalyticsAccepted = useConsentStore((s) => s.setAnalyticsAccepted)

  return (
    <ConsentChoiceScreen
      copy={consentCopy.analytics}
      defaultChecked
      onContinue={(checked) => {
        setAnalyticsAccepted(checked)
        continueConsentChain('/analytics-consent')
      }}
    />
  )
}
