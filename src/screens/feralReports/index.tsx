import { STATUS_COLOR_KEY } from '@/src/components/atoms/StatusIcon'
import { ReportCard } from '@/src/components/molecules/ReportCard'
import { useFeralReports } from '@/src/hooks/useFeralReports'
import type { CacheStatus } from '@/src/lib/cache/submissionCache'
import { Stack } from 'expo-router'
import { Clock, RefreshCw } from 'lucide-react-native'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { styles } from './index.styles'

const STATUSES: CacheStatus[] = ['In Progress', 'Sending', 'Submitted', 'Failed']

export default function FeralReportsScreen() {
  const { caches, refreshing, load, onRefresh } = useFeralReports()

  return (
    <>
      <Stack.Screen options={{
        title: 'Feral Reports', headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text, headerTitleStyle: { fontWeight: '700', color: theme.colors.text },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable onPress={load} style={styles.headerIcon} accessibilityRole="button">
            <RefreshCw size={20} color={theme.colors.text} />
          </Pressable>
        ),
      }} />
      <ScrollView style={styles.root} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        contentContainerStyle={styles.scrollContent}>
        <View style={styles.inner}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Feral Reports</Text>
            <Text style={styles.total}>{caches.length} total</Text>
          </View>
          {caches.length === 0 ? (
            <View style={styles.empty}>
              <Clock size={32} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptyBody}>Submissions appear here as you create them</Text>
            </View>
          ) : (
            <>
              <View style={styles.legend}>
                {STATUSES.map((s) => (
                  <View key={s} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.colors[STATUS_COLOR_KEY[s]] }]} />
                    <Text style={styles.legendLabel}>{s}</Text>
                  </View>
                ))}
              </View>
              {caches.map((cache) => <ReportCard key={cache.id} cache={cache} />)}
            </>
          )}
        </View>
      </ScrollView>
    </>
  )
}

