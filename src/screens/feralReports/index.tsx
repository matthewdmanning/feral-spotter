import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { STATUS_COLOR_KEY } from '@/src/components/atoms/StatusIcon'
import { ReportCard } from '@/src/components/molecules/ReportCard'
import { useFeralReports } from '@/src/hooks/useFeralReports'
import type {
  CacheStatus,
  SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'
import { Stack } from 'expo-router'
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock'
import { FlatList, RefreshControl, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const STATUSES: CacheStatus[] = [
  'In Progress',
  'Sending',
  'Submitted',
  'Failed',
]

const keyExtractor = (cache: SubmissionCacheFile) => cache.id
const renderItem = ({ item }: { item: SubmissionCacheFile }) => (
  <ReportCard cache={item} />
)

export default function FeralReportsScreen() {
  const { theme } = useUnistyles()
  const { caches, refreshing, onRefresh } = useFeralReports()

  return (
    <>
      {/*
        This screen is reachable both as a tab ((home-tabs)/feral-reports,
        headerShown false at the Tabs level — see (home-tabs)/_layout.tsx)
        and, in principle, as a plain stack push (app/feral-reports.tsx),
        where the root Stack's default headerShown: true would otherwise
        apply. Forcing it off here keeps this screen's own in-body title
        row (below) as the only header on every path — one rendering to
        keep in sync with the safe-area inset, instead of two.
      */}
      <Stack.Screen options={{ title: 'Feral Reports', headerShown: false }} />
      <View style={styles.screen}>
        <AmbientBackground />
        {/* FlatList, not ScrollView + map: a long history renders only the
            cards near the screen. The title row, legend and empty state ride
            in the list's own header and empty slots, so there is one
            scroller. */}
        <FlatList
          style={styles.root}
          data={caches}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
            />
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Feral Reports</Text>
                <Text style={styles.total}>{caches.length} total</Text>
              </View>
              {caches.length > 0 && (
                <View style={styles.legend}>
                  {STATUSES.map((s) => (
                    <View key={s} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          {
                            backgroundColor: theme.colors[STATUS_COLOR_KEY[s]],
                          },
                        ]}
                      />
                      <Text style={styles.legendLabel}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <ClockIcon
                  size={theme.iconSize.xl}
                  color={theme.colors.accentSoftText}
                />
              </View>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptyBody}>
                Submissions appear here as you create them
              </Text>
            </View>
          }
        />
      </View>
    </>
  )
}
