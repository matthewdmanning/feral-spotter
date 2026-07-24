/**
 * screens/dataAgreement/index.tsx
 * Read-only full data usage agreement — linked from onboarding's T3 slide.
 * Mirrors /consent's disclosure copy (single source: consentDisclosure.json)
 * rather than duplicating the text. No accept action here — /consent owns
 * the actual consent gate.
 */

import { ScrollView, Text, View } from 'react-native'
import agreementCopy from '@/src/content/consentDisclosure.json'
import { styles } from './index.styles'

export default function DataAgreementScreen() {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{agreementCopy.title}</Text>
        <Text style={styles.body}>{agreementCopy.intro}</Text>
        {agreementCopy.items.map((item) => (
          <Text key={item.label} style={styles.item}>
            <Text style={styles.itemLabel}>{item.label}</Text> {item.text}
          </Text>
        ))}
        {agreementCopy.body.map((paragraph) => (
          <Text key={paragraph} style={styles.body}>{paragraph}</Text>
        ))}
      </ScrollView>
    </View>
  )
}
