import { GlassSurface } from '@/src/components/atoms/GlassSurface'
import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { AppButton } from '@/src/components/atoms/AppButton'
import { CheckboxBox } from '@/src/components/atoms/CheckboxBox'
import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { styles } from './ConsentChoiceScreen.styles'

interface ConsentChoiceScreenProps {
  copy: {
    title: string
    intro: string
    label: string
    text: string
    continueLabel: string
  }
  /** Whether the box starts checked. Opt-ins start unchecked. */
  defaultChecked: boolean
  /** Shown under the checkbox, e.g. where the choice takes effect. */
  footnote?: string
  onContinue: (checked: boolean) => void
}

/** One titled checkbox with a Continue button: the shape of every consent step. */
export function ConsentChoiceScreen({
  copy,
  defaultChecked,
  footnote,
  onContinue,
}: ConsentChoiceScreenProps) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.intro}</Text>

        <Pressable
          onPress={() => setChecked((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={`${copy.label}: ${copy.text}`}
        >
          <GlassSurface kind="card" style={styles.choiceRow}>
            <CheckboxBox checked={checked} />
            <Text style={styles.choiceItemText}>
              <Text style={styles.itemLabel}>{copy.label}</Text> {copy.text}
            </Text>
          </GlassSurface>
        </Pressable>
        {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}

        <View style={styles.continueRow}>
          <AppButton onPress={() => onContinue(checked)}>
            {copy.continueLabel}
          </AppButton>
        </View>
      </ScrollView>
    </View>
  )
}
