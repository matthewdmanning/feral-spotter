import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { STATUS_COLOR_KEY } from '@/src/components/atoms/StatusIcon'
import { ReportCard } from '@/src/components/molecules/ReportCard'
import { SightingsMap } from '@/src/components/organisms/SightingsMap'
import { useFeralReports } from '@/src/hooks/useFeralReports'
import type { CacheStatus } from '@/src/lib/cache/submissionCache'
import type { SightingSpot } from '@/src/lib/sightings/history'
import { router, Stack } from 'expo-router'
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock'
import { useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const STATUSES: CacheStatus[] = [
  'In Progress',
  'Sending',
  'Submitted',
  'Failed',
]

export default function FeralReportsScreen() {
  const { theme } = useUnistyles()
  const { caches, spots, resumableId, refreshing, onRefresh } =
    useFeralReports()
  // Off while a finger is on the map, so a pan moves the map, not the page.
  const [scrollEnabled, setScrollEnabled] = useState(true)
  // A pin can hold several Sightings; it opens the newest. The rest are in
  // the list below.
  const handleSpotPress = (spot: SightingSpot) =>
    router.push({
      pathname: '/sighting/[id]',
      params: { id: spot.sightingIds[0] },
    })

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
        <ScrollView
          style={styles.root}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.inner}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Feral Reports</Text>
              <Text style={styles.total}>{caches.length} total</Text>
            </View>
            {caches.length === 0 ? (
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
            ) : (
              <>
                <SightingsMap
                  spots={spots}
                  onSpotPress={handleSpotPress}
                  onTouchActiveChange={(active) => setScrollEnabled(!active)}
                />
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
                {caches.map((cache) => (
                  <ReportCard
                    key={cache.id}
                    cache={cache}
                    resumableId={resumableId}
                  />
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  )
}
