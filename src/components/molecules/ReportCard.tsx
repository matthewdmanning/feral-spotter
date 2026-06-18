import { STATUS_COLOR_KEY, StatusIcon } from '@/src/components/atoms/StatusIcon'
import type { SubmissionCacheFile } from '@/src/lib/cache/submissionCache'
import { formatDateTime } from '@/src/utils/formatDateTime'
import { Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './ReportCard.styles'

export function ReportCard({ cache }: { cache: SubmissionCacheFile }) {
  const { theme } = useUnistyles()
  const catCount = cache.cats.length
  const photoCount = cache.photo_links?.length ?? 0
  const colorKey = STATUS_COLOR_KEY[cache.status]

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <StatusIcon status={cache.status} />
          <Text style={styles.catCount}>{catCount === 0 ? 'None' : `Cats: ${catCount}`}</Text>
        </View>
        <View style={styles.centre}>
          <Text style={styles.datetime} numberOfLines={1}>{formatDateTime(cache.created_at)}</Text>
        </View>
        <View style={styles.right}>
          {photoCount > 0 && <Text style={styles.photoCount}>{photoCount} photo{photoCount !== 1 ? 's' : ''}</Text>}
          <Text style={[styles.status, { color: theme.colors[colorKey] }]}>{cache.status}</Text>
        </View>
      </View>
    </View>
  )
}

