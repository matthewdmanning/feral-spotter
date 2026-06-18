import { CatForm } from '@/src/components/organisms/CatForm'
import { useSubmissionStore } from '@/src/hooks'
import { useCatForm } from '@/src/hooks/useCatForm'
import { useCatSubmit } from '@/src/hooks/useCatSubmit'
import { useSettingsStore } from '@/src/hooks/useSettingsStore'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

export default function CatObservationScreen() {
  const { theme } = useUnistyles()
  const { edit: editId } = useLocalSearchParams<{ edit?: string }>()

  const cats = useSubmissionStore((s) => s.cats)
  const existingCat = editId ? cats.find((c) => c.local_id === editId) : undefined
  const annotationEnabled = useSettingsStore((s) => s.settings.annotation_enabled)

  const form = useCatForm(existingCat)
  const submit = useCatSubmit({ form, existingCat, annotationEnabled })

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>{existingCat ? 'Edit Cat' : 'Observed Cat'}</Text>
          <View style={styles.headerActions}>
            <Pressable onPress={form.handleClear} style={styles.headerBtn} accessibilityRole="button">
              <Text style={[styles.headerBtnText, { color: theme.colors.danger }]}>Clear</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable onPress={submit.handleReset} style={styles.headerBtn} accessibilityRole="button">
              <Text style={[styles.headerBtnText, { color: theme.colors.danger }]}>Reset</Text>
            </Pressable>
          </View>
        </View>
        <CatForm form={form} submit={submit} existingCat={existingCat} annotationEnabled={annotationEnabled} />
      </View>
    </ScrollView>
  )
}

