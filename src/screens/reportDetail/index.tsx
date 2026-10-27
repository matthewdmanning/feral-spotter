/**
 * screens/reportDetail
 * Read-only view of one past Sighting, opened from a Reports card or map pin.
 * Same content as Submission Details, but every answer is plain text — no
 * selectors, no edit or delete. History is a record, not a draft.
 */

import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { CatCrop } from '@/src/components/atoms/CatCrop'
import { StatusIcon } from '@/src/components/atoms/StatusIcon'
import { useReport } from '@/src/hooks/useFeralReports'
import {
  describeSighting,
  profilePicUri,
  sightingTime,
} from '@/src/lib/reports/history'
import {
  describeCat,
  summarizeCat,
} from '@/src/screens/submission/cats/attributes'
import { formatDateTime } from '@/src/utils/formatDateTime'
import { Stack, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

export const PROFILE_PIC_SIZE = 96

export default function ReportDetailScreen() {
  const { theme } = useUnistyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { report } = useReport(id)

  if (report === undefined) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    )
  }

  if (report === null) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <AmbientBackground />
        <Text style={styles.emptyTitle}>Sighting not found</Text>
        <Text style={styles.emptyBody}>
          It is no longer saved on this device.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Sighting' }} />
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <StatusIcon status={report.status} size={theme.iconSize.lg} />
          <Text style={styles.datetime}>
            {formatDateTime(sightingTime(report))}
          </Text>
        </View>

        <View style={styles.card}>
          {describeSighting(report).map(({ label, value }) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Cats Recorded</Text>
        {report.cats.length === 0 && (
          <Text style={styles.emptyBody}>No cats recorded.</Text>
        )}
        {report.cats.map((cat, index) => (
          <View key={cat.local_id} style={styles.card}>
            <View style={styles.catHeader}>
              <CatCrop
                uri={profilePicUri(report, cat)}
                box={cat.profile_box}
                size={PROFILE_PIC_SIZE}
                accessibilityLabel={`Profile picture of cat ${index + 1}`}
              />
              <Text style={styles.catTitle}>{summarizeCat(cat)}</Text>
            </View>
            {describeCat(cat).map(({ label, value }) => (
              <View key={label} style={styles.row}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  )
}
