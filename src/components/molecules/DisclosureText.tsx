import consentCopy from '@/src/content/consentDisclosure.json'
import { Text } from 'react-native'
import { styles } from './DisclosureText.styles'

/**
 * The data-collection disclosure body: intro, labelled items, then the
 * closing paragraphs. One rendering of consentDisclosure.json, shared by the
 * consent gate and the read-only Data Usage Agreement.
 */
export function DisclosureText() {
  return (
    <>
      <Text style={styles.paragraph}>{consentCopy.intro}</Text>
      {consentCopy.items.map((item) => (
        <Text key={item.label} style={styles.item}>
          <Text style={styles.itemLabel}>{item.label}</Text> {item.text}
        </Text>
      ))}
      {consentCopy.body.map((paragraph) => (
        <Text key={paragraph} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
    </>
  )
}
