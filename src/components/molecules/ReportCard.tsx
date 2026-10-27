import { STATUS_COLOR_KEY, StatusIcon } from '@/src/components/atoms/StatusIcon'
import type { SubmissionCacheFile } from '@/src/lib/cache/submissionCache'
import { selectionHaptic } from '@/src/lib/haptics'
import {
  sightingCardAction,
  sightingPhotoCount,
  sightingTime,
} from '@/src/lib/sightings/history'
import { formatDateTime } from '@/src/utils/formatDateTime'
import { router } from 'expo-router'
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight'
import { Pressable, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './ReportCard.styles'

interface ReportCardProps {
  cache: SubmissionCacheFile
  /** The draft Home would resume; that one In Progress card resumes it. */
  resumableId: string | undefined
}

export function ReportCard({ cache, resumableId }: ReportCardProps) {
  const { theme } = useUnistyles()
  const catCount = cache.cats.length
  const photoCount = sightingPhotoCount(cache)
  const colorKey = STATUS_COLOR_KEY[cache.status]
  const when = formatDateTime(sightingTime(cache))
  const action = sightingCardAction(cache, resumableId)

  const row = (
    <View style={styles.row}>
      <View style={styles.left}>
        <StatusIcon status={cache.status} />
        <Text style={styles.catCount}>
          {catCount === 0 ? 'None' : `Cats: ${catCount}`}
        </Text>
      </View>
      <View style={styles.centre}>
        <Text style={styles.datetime} numberOfLines={1}>
          {when}
        </Text>
      </View>
      <View style={styles.right}>
        {photoCount > 0 && (
          <Text style={styles.photoCount}>
            {photoCount} photo{photoCount !== 1 ? 's' : ''}
          </Text>
        )}
        <Text style={[styles.status, { color: theme.colors[colorKey] }]}>
          {cache.status}
        </Text>
      </View>
      {action && (
        <CaretRightIcon size={theme.iconSize.sm} color={theme.colors.muted} />
      )}
    </View>
  )

  // An abandoned draft has nothing to open, so it is not a button.
  if (!action) return <View style={styles.card}>{row}</View>

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => {
        selectionHaptic()
        if (action === 'resume') router.push('/submission/create')
        else
          router.push({ pathname: '/sighting/[id]', params: { id: cache.id } })
      }}
      accessibilityRole="button"
      accessibilityLabel={`Sighting, ${cache.status}, ${when}`}
      accessibilityHint={
        action === 'resume'
          ? 'Continues this observation'
          : "Opens the Sighting's details"
      }
    >
      {row}
    </Pressable>
  )
}
