/**
 * features/permissions/screens/dataAgreement/index.tsx
 * Read-only full data usage agreement — linked from intro flow's T3 slide
 * and from Settings. Mirrors /consent's disclosure copy (single source:
 * consentDisclosure.json) rather than duplicating the text. /consent owns
 * the accept action.
 *
 * Before consent (NAV-1): Deny declines as Consent's Decline does. Android
 * Back is ignored once, and the second Back declines the same way. After
 * consent (opened from Settings) it is a plain read-only page.
 */

import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { DisclosureText } from '@/src/features/permissions/components/DisclosureText'
import agreementCopy from '@/src/features/permissions/copy/consentDisclosure.json'
import { useDataAgreementDecline } from '@/src/features/permissions/hooks/useDataAgreementDecline'
import { Text } from '@/src/shared/ui/atoms/Text'
import { ScrollView, View } from 'react-native'
import { styles } from './index.styles'

export default function DataAgreementScreen() {
  const { canDeny, deny } = useDataAgreementDecline()
  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{agreementCopy.title}</Text>
        <DisclosureText />
        {canDeny ? (
          <TextButton
            onPress={deny}
            tone="muted"
            underline
            style={styles.denyBtn}
          >
            {agreementCopy.denyLabel}
          </TextButton>
        ) : null}
      </ScrollView>
    </View>
  )
}
