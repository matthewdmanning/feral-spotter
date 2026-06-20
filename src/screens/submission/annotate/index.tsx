import { AnnotateCarouselItem } from '@/src/components/organisms/AnnotateCarouselItem'
import { useAnnotateStateMachine } from '@/src/hooks/useAnnotateStateMachine'
import { router, useLocalSearchParams } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Dimensions, Pressable, Text, View } from 'react-native'
import Carousel from 'react-native-reanimated-carousel'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const SCREEN_W = Dimensions.get('window').width

export default function AnnotateScreen() {
  const { theme } = useUnistyles()
  const { cat_id } = useLocalSearchParams<{ cat_id: string }>()
  const { photos, statuses, currentIndex, setCurrentIndex, carouselRef,
    handleDone, handleBack, handleLongPressRemove } = useAnnotateStateMachine(cat_id)
  const [carouselHeight, setCarouselHeight] = useState(0)
  const [zoomedIn, setZoomedIn] = useState(false)

  if (photos.length === 0) return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>No photos to review.</Text>
      <Pressable onPress={() => router.back()} style={styles.emptyBtn} accessibilityRole="button">
        <Text style={styles.emptyBtnText}>Go back</Text>
      </Pressable>
    </View>
  )

  const isFirst = currentIndex === 0
  const isLast = currentIndex === photos.length - 1

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <Pressable onPress={handleDone} style={styles.topBtn} accessibilityRole="button">
            <Text style={styles.topBtnText}>Done</Text>
          </Pressable>
          <Text style={styles.counter}>{currentIndex + 1} / {photos.length}</Text>
          <Pressable onPress={() => Alert.alert('Remove photo', 'Long press to remove.')}
            onLongPress={handleLongPressRemove} delayLongPress={500}
            style={styles.removeBtn} accessibilityRole="button">
            <Trash2 size={18} color={theme.colors.muted} />
          </Pressable>
        </View>
        <View style={styles.dotsRow}>
          {photos.map((photo, i) => {
            const s = statuses[photo.local_id]
            return <View key={photo.local_id} style={[styles.dot, {
              width: i === currentIndex ? 20 : 7,
              backgroundColor: i === currentIndex ? theme.colors.text : s === 'located' ? theme.colors.accent : s === 'dismissed' ? theme.colors.surfaceAlt : theme.colors.muted,
            }]} />
          })}
        </View>
      </View>

      {/* Carousel — flex 1 */}
      <View style={styles.carousel} onLayout={(e) => setCarouselHeight(e.nativeEvent.layout.height)}>
        {carouselHeight > 0 && (
          <Carousel ref={carouselRef} width={SCREEN_W} height={carouselHeight}
            data={photos} defaultIndex={0} onSnapToItem={setCurrentIndex}
            scrollAnimationDuration={200}
            enabled={!zoomedIn}
            renderItem={({ item }) => (
              <AnnotateCarouselItem photo={item} catId={cat_id} width={SCREEN_W} height={carouselHeight}
                onConfirm={handleDone} onZoomChange={setZoomedIn} />
            )} />
        )}
      </View>

      {/* Bottom buttons — below carousel, never covered by canvas */}
      <View style={styles.bottomBar}>
        <Pressable onPress={handleBack} disabled={isFirst}
          style={[styles.navBtn, styles.navBtnSecondary, isFirst && styles.navBtnDisabled]}
          accessibilityRole="button">
          <Text style={styles.navBtnSecondaryText}>← Back</Text>
        </Pressable>
        <Pressable onPress={handleDone} style={[styles.navBtn, styles.navBtnPrimary]} accessibilityRole="button">
          <Text style={styles.navBtnPrimaryText}>{isLast ? 'Finish' : 'Done →'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

