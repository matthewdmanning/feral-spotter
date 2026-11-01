import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { CheckIcon } from 'phosphor-react-native/src/icons/Check'
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
  const { theme } = useUnistyles()
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
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && (
                <CheckIcon
                  size={theme.iconSize.sm}
                  color={theme.colors.accentText}
                />
              )}
            </View>
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
