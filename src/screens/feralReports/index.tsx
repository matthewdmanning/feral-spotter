import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { STATUS_COLOR_KEY } from '@/src/components/atoms/StatusIcon'
import { ReportCard } from '@/src/components/molecules/ReportCard'
import { SightingsMap } from '@/src/components/organisms/SightingsMap'
import { useFeralReports } from '@/src/hooks/useFeralReports'
import type {
  CacheStatus,
  SubmissionCacheFile,
} from '@/src/lib/cache/submissionCache'
import type { SightingSpot } from '@/src/lib/sightings/history'
import { router, Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock'
import { FlashList } from '@shopify/flash-list'
import { RefreshControl, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const STATUSES: CacheStatus[] = [
  'In Progress',
  'Sending',
  'Submitted',
  'Failed',
]

const Separator = () => <View style={styles.separator} />
const keyExtractor = (cache: SubmissionCacheFile) => cache.id

export default function FeralReportsScreen() {
  const { theme } = useUnistyles()
  const { caches, spots, resumableId, refreshing, onRefresh } =
    useFeralReports()
  // Let a map gesture pan the map instead of the surrounding history list.
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const handleTouchActiveChange = useCallback((active: boolean) => {
    setScrollEnabled(!active)
  }, [])
  const handleSpotPress = useCallback((spot: SightingSpot) => {
    router.push({
      pathname: '/sighting/[id]',
      params: { id: spot.sightingIds[0] },
    })
  }, [])
  const renderItem = useCallback(
    ({ item }: { item: SubmissionCacheFile }) => (
      <ReportCard cache={item} resumableId={resumableId} />
    ),
    [resumableId],
  )

  return (
    <>
      {/*
        This screen is reachable both as a tab ((home-tabs)/feral-reports,
        where native tabs draw no header — see (home-tabs)/_layout.tsx)
        and, in principle, as a plain stack push (app/feral-reports.tsx),
        where the root Stack's default headerShown: true would otherwise
        apply. Forcing it off here keeps this screen's own in-body title
        row (below) as the only header on every path — one rendering to
        keep in sync with the safe-area inset, instead of two.
      */}
      <Stack.Screen options={{ title: 'Feral Reports', headerShown: false }} />
      <View style={styles.screen}>
        <AmbientBackground />
        {/* FlashList (already the app's list library), not ScrollView + map:
            a long history recycles the cards near the screen. The title row,
            legend and empty state ride in the list's own header and empty
            slots, so there is one scroller. FlashList's content style takes
            padding only, so the card gap is ItemSeparatorComponent. */}
        <FlashList
          style={styles.root}
          data={caches}
          extraData={resumableId}
          scrollEnabled={scrollEnabled}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={Separator}
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
              <SightingsMap
                spots={spots}
                onSpotPress={handleSpotPress}
                onTouchActiveChange={handleTouchActiveChange}
              />
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
            <GlassSurface kind="card" style={styles.empty}>
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
            </GlassSurface>
          }
        />
      </View>
    </>
  )
}
