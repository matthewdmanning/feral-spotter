/**
 * screens/sightingDetail
 * Read-only view of one past Sighting, opened from a Reports card or map pin.
 * Same content as Submission Details, but every answer is plain text — no
 * selectors, no edit or delete. History is a record, not a draft.
 */

import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { CatCrop } from '@/src/shared/ui/atoms/CatCrop'
import {
  STATUS_COLOR_KEY,
  StatusIcon,
} from '@/src/features/history/components/StatusIcon'
import { FieldRow } from '@/src/shared/ui/molecules/FieldRow'
import { useSighting } from '@/src/features/history/hooks/useSighting'
import {
  describeCat,
  summarizeCat,
} from '@/src/features/draft-submission/lib/attributes'
import {
  describeSighting,
  profilePicUri,
  sightingTime,
} from '@/src/features/history/lib/history'
import { formatDateTime } from '@/src/shared/utils/formatDateTime'
import { useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

/** Larger than Cat Form's picker crops: here the photo is the cat's header. */
const CAT_PHOTO_SIZE = 96

export default function SightingDetailScreen() {
  const { theme } = useUnistyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { sighting } = useSighting(id)

  if (sighting === undefined) {
    return (
      <View style={[styles.screen, styles.centred]}>
        <AmbientBackground />
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    )
  }

  if (sighting === null) {
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
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <StatusIcon status={sighting.status} size={theme.iconSize.lg} />
          <View style={styles.headerText}>
            <Text style={styles.datetime}>
              {formatDateTime(sightingTime(sighting))}
            </Text>
            <Text
              style={[
                styles.status,
                { color: theme.colors[STATUS_COLOR_KEY[sighting.status]] },
              ]}
            >
              {sighting.status}
            </Text>
          </View>
        </View>

        <GlassSurface kind="card" style={styles.card}>
          {describeSighting(sighting).map(({ label, value }) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
        </GlassSurface>

        <Text style={styles.sectionTitle}>Cats Recorded</Text>
        {sighting.cats.length === 0 && (
          <Text style={styles.emptyBody}>No cats recorded.</Text>
        )}
        {sighting.cats.map((cat, index) => (
          <GlassSurface kind="card" key={cat.local_id} style={styles.card}>
            <View style={styles.catHeader}>
              <CatCrop
                uri={profilePicUri(sighting, cat)}
                box={cat.profile_box}
                size={CAT_PHOTO_SIZE}
                accessibilityLabel={`Profile Pic of cat ${index + 1}`}
              />
              <Text style={styles.catTitle}>{summarizeCat(cat)}</Text>
            </View>
            {describeCat(cat).map(({ label, value }) => (
              <FieldRow key={label} label={label} value={value} />
            ))}
          </GlassSurface>
        ))}
      </ScrollView>
    </View>
  )
}
