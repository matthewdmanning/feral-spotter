import { showAlert } from '@/src/shared/hooks/useUIStore'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { AnnotateCarouselItem } from '@/src/features/annotate/components/AnnotateCarouselItem'
import { InsetCropBubble } from '@/src/features/annotate/components/InsetCropBubble'
import { TutorialOverlay } from '@/src/features/annotate/components/TutorialOverlay'
import { ANNOTATION_TUTORIAL_STEPS } from '@/src/features/annotate/config/tutorial'
import { useAnnotationTutorial } from '@/src/features/annotate/hooks/useAnnotationTutorial'
import { useAnnotatePass } from '@/src/features/annotate/hooks/useAnnotatePass'
import { useBackHandler } from '@/src/shared/hooks/useBackHandler'
import { router } from 'expo-router'
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash'
import { useState } from 'react'
import { Dimensions, Pressable, Text, View } from 'react-native'
import Carousel from 'react-native-reanimated-carousel'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'
import { PHOTO_STATUS_COLOR_KEY } from './photoStatusColors'

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

  // Buttons only, no swipe/back exit mid-pass (annotate is a fullScreenModal
  // with gestureEnabled/headerShown off). BackHandler can't distinguish an
  // edge-swipe from a physical back-press — they're the same JS event — so
  // swallowing it here blocks both. "Done With This Cat" already covers
  // every exit case: it falls back to handleAbandonPass itself whenever
  // there's no active cat or no confirmed boxes yet (useActiveCatFlow).
  useBackHandler(() => true)

  const tutorial = useAnnotationTutorial()

  if (photos.length === 0)
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No photos to review.</Text>
        <AppButton
          variant="secondary"
          onPress={() => {
            clearActiveCat()
            router.back()
          }}
        >
          Go back
        </AppButton>
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
            onPress={() => showAlert('Remove photo', 'Long press to remove.')}
            onLongPress={handleLongPressRemove}
            delayLongPress={500}
            style={styles.removeBtn}
            // 36dp bordered box; hitSlop reaches the 48dp floor without
            // resizing the visible chrome.
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
          >
            <TrashIcon size={theme.iconSize.md} color={theme.colors.muted} />
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
                    width:
                      i === currentIndex ? theme.spacing.xl : theme.spacing.sm,
                    backgroundColor:
                      theme.colors[
                        i === currentIndex ? 'text' : PHOTO_STATUS_COLOR_KEY[s]
                      ],
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
            enabled={false}
            renderItem={({ item }) => (
              <AnnotateCarouselItem
                photo={item}
                activeCatId={activeCatId}
                width={SCREEN_W}
                height={carouselHeight}
                onConfirm={handleConfirmBox}
                onNotInPhoto={handleNotInPhoto}
              />
            )}
          />
        )}

        {/* Floating inset crop (#174) — hidden until the first box is
            confirmed for the current cat (activeCatId is null until then).
            Positioned relative to this carousel container, not the screen
            root (#202) — its top-right dock needs to clear topBar's
            counter/remove-button row, not overlap it, and RN Views
            default to position: relative, so top: 0 here already lands
            below topBar without hardcoding its height. */}
        {activeCatId && (
          <InsetCropBubble catId={activeCatId} edge="top-right" draggable />
        )}
      </View>

      {/* #375: "← Previous" is dead on the first photo, and the dots alone
          did not say so. There is no way out to name — this is the first
          photo. */}
      {isFirst && photos.length > 1 && (
        <Text style={styles.disabledReason}>
          You are on the first photo of {photos.length}.
        </Text>
      )}

      {/* Bottom buttons — below carousel, never covered by canvas */}
      <View style={styles.bottomBar}>
        <AppButton
          variant="secondary"
          size="compact"
          onPress={handlePrevPhoto}
          disabled={isFirst}
          flex1
        >
          ← Previous
        </AppButton>
        <AppButton
          variant="secondary"
          size="compact"
          onPress={handleNotInPhoto}
          accessibilityLabel="Not in this photo"
        >
          Not in Photo
        </AppButton>
        <AppButton size="compact" onPress={handleBoxingComplete} flex1>
          Done With This Cat
        </AppButton>
      </View>

      <TutorialOverlay {...tutorial} steps={ANNOTATION_TUTORIAL_STEPS} />
    </View>
  )
}
