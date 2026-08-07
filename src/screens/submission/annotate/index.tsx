import { AnnotateCarouselItem } from '@/src/components/organisms/AnnotateCarouselItem'
import { InsetCropBubble } from '@/src/components/organisms/InsetCropBubble'
import { TutorialOverlay } from '@/src/components/organisms/TutorialOverlay'
import {
  ANNOTATION_TUTORIAL_STEPS,
  isTutorialReleased,
} from '@/src/config/tutorial'
import { useAnnotatePass } from '@/src/hooks/useAnnotatePass'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import { useTutorialStore } from '@/src/hooks/useTutorialStore'
import { EVENTS, captureEvent } from '@/src/lib/analytics/analytics'
import { router } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Alert, Dimensions, Pressable, Text, View } from 'react-native'
import Carousel from 'react-native-reanimated-carousel'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

const SCREEN_W = Dimensions.get('window').width

export default function AnnotateScreen() {
  const { theme } = useUnistyles()
  const {
    photos,
    activeCatId,
    getPhotoStatus,
    currentIndex,
    setCurrentIndex,
    carouselRef,
    handleConfirmBox,
    handleNotInPhoto,
    handleBoxingComplete,
    clearActiveCat,
    handlePrevPhoto,
    handleLongPressRemove,
  } = useAnnotatePass()
  const [carouselHeight, setCarouselHeight] = useState(0)
  const [zoomedIn, setZoomedIn] = useState(false)

  // Hardware back is the only way to leave mid-pass (annotate is a
  // fullScreenModal with gestureEnabled/headerShown off) — clear the active
  // cat so a later "Add a Cat" mints a fresh one instead of resuming this
  // abandoned pass. Boxes already drawn stay in useBoundingBoxStore
  // untouched (story: mid-pass abandonment keeps data; cleanup deferred).
  useBackHandler(() => {
    clearActiveCat()
    return false
  })

  // ── Tutorial (first annotation entry only; replay resets status to 'unseen')
  const tutorialStatus = useTutorialStore((s) => s.annotation_tutorial_status)
  const setTutorialStatus = useTutorialStore(
    (s) => s.setAnnotationTutorialStatus,
  )
  const [tutorialStartedAt, setTutorialStartedAt] = useState(0)
  const handleTutorialShow = () => {
    setTutorialStartedAt(Date.now())
    captureEvent(EVENTS.TUTORIAL_STARTED)
  }
  const handleTutorialStep = (step: number) =>
    captureEvent(EVENTS.TUTORIAL_STEP_COMPLETED, { step })
  const handleTutorialSkip = (step: number) => {
    setTutorialStatus('skipped')
    captureEvent(EVENTS.TUTORIAL_SKIPPED, { step })
  }
  const handleTutorialComplete = () => {
    setTutorialStatus('completed')
    captureEvent(EVENTS.TUTORIAL_COMPLETED, {
      duration_ms: Date.now() - tutorialStartedAt,
    })
  }

  if (photos.length === 0)
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No photos to review.</Text>
        <Pressable
          onPress={() => {
            clearActiveCat()
            router.back()
          }}
          style={styles.emptyBtn}
          accessibilityRole="button"
        >
          <Text style={styles.emptyBtnText}>Go back</Text>
        </Pressable>
      </View>
    )

  const isFirst = currentIndex === 0

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <Text style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </Text>
          <Pressable
            onPress={() => Alert.alert('Remove photo', 'Long press to remove.')}
            onLongPress={handleLongPressRemove}
            delayLongPress={500}
            style={styles.removeBtn}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <Trash2 size={18} color={theme.colors.muted} />
          </Pressable>
        </View>
        <View style={styles.dotsRow}>
          {photos.map((photo, i) => {
            const s = getPhotoStatus(photo.local_id)
            return (
              <View
                key={photo.local_id}
                style={[
                  styles.dot,
                  {
                    width: i === currentIndex ? 20 : 7,
                    backgroundColor:
                      i === currentIndex
                        ? theme.colors.text
                        : s === 'located'
                          ? theme.colors.accent
                          : s === 'not-in-photo'
                            ? theme.colors.warning
                            : theme.colors.muted,
                  },
                ]}
              />
            )
          })}
        </View>
      </View>

      {/* Carousel — flex 1 */}
      <View
        style={styles.carousel}
        onLayout={(e) => setCarouselHeight(e.nativeEvent.layout.height)}
      >
        {carouselHeight > 0 && (
          <Carousel
            ref={carouselRef}
            width={SCREEN_W}
            height={carouselHeight}
            data={photos}
            defaultIndex={0}
            onSnapToItem={setCurrentIndex}
            scrollAnimationDuration={200}
            enabled={!zoomedIn}
            renderItem={({ item }) => (
              <AnnotateCarouselItem
                photo={item}
                activeCatId={activeCatId}
                width={SCREEN_W}
                height={carouselHeight}
                onConfirm={handleConfirmBox}
                onZoomChange={setZoomedIn}
              />
            )}
          />
        )}
      </View>

      {/* Floating inset crop (#174) — hidden until the first box is
          confirmed for the current cat (activeCatId is null until then). */}
      {activeCatId && (
        <InsetCropBubble catId={activeCatId} edge="bottom-right" />
      )}

      {/* Bottom buttons — below carousel, never covered by canvas */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={handlePrevPhoto}
          disabled={isFirst}
          style={[
            styles.navBtn,
            styles.navBtnSecondary,
            isFirst && styles.navBtnDisabled,
          ]}
          accessibilityRole="button"
        >
          <Text style={styles.navBtnSecondaryText}>← Back</Text>
        </Pressable>
        <Pressable
          onPress={handleNotInPhoto}
          disabled={!activeCatId}
          style={[styles.pillBtn, !activeCatId && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Not in this photo"
        >
          <Text style={styles.pillBtnText}>Not in Photo</Text>
        </Pressable>
        <Pressable
          onPress={handleBoxingComplete}
          style={[styles.navBtn, styles.navBtnPrimary]}
          accessibilityRole="button"
        >
          <Text style={styles.navBtnPrimaryText}>Boxing Complete</Text>
        </Pressable>
      </View>

      <TutorialOverlay
        open={isTutorialReleased() && tutorialStatus === 'unseen'}
        steps={ANNOTATION_TUTORIAL_STEPS}
        onShow={handleTutorialShow}
        onStepCompleted={handleTutorialStep}
        onSkip={handleTutorialSkip}
        onComplete={handleTutorialComplete}
      />
    </View>
  )
}
