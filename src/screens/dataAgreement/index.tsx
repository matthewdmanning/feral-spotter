/**
 * screens/dataAgreement/index.tsx
 * Read-only full data usage agreement — linked from intro flow's T3 slide.
 * Mirrors /consent's disclosure copy (single source: consentDisclosure.json)
 * rather than duplicating the text. No accept action here — /consent owns
 * the actual consent gate.
 */

import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { DisclosureText } from '@/src/components/molecules/DisclosureText'
import agreementCopy from '@/src/features/permissions/consent/content/consentDisclosure.json'
import { ScrollView, Text, View } from 'react-native'
import { styles } from './index.styles'

export default function DataAgreementScreen() {
  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{agreementCopy.title}</Text>
        <DisclosureText />
      </ScrollView>
    </View>
  )
}
