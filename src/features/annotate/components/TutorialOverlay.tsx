/**
 * components/organisms/TutorialOverlay.tsx
 * Step-by-step tutorial overlay shown over the annotate screen.
 * Steps are passed as data so future tutorials can reuse the component.
 *
 * Skeleton (first pass): all steps advance via the primary button.
 * TODO(second pass): gesture-validated advancement (draw/adjust/label on a
 * sandboxed sample photo) per docs/planning/2026-07-14-annotation-tutorial-spec.md.
 */

import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { Modal, ScrollView, Text, View } from 'react-native'
import { useState } from 'react'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './TutorialOverlay.styles'

// ─── Types ────────────────────────────────────────────────────────────────────

import type { TutorialStep } from '@/src/shared/types/Tutorial'
export type { TutorialStep }

interface TutorialOverlayProps {
  open: boolean
  steps: TutorialStep[]
  /** Fired when the overlay becomes visible (analytics start marker) */
  onShow: () => void
  /** Fired once when the user advances past a step (1-based step number) */
  onStepCompleted: (step: number) => void
  /** Fired when the user skips (1-based step number they skipped from) */
  onSkip: (step: number) => void
  /** Fired when the user finishes the last step */
  onComplete: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TutorialOverlay({
  open,
  steps,
  onShow,
  onStepCompleted,
  onSkip,
  onComplete,
}: TutorialOverlayProps) {
  // Subscribes this component to theme changes. Required: content inside RN's
  // Modal renders on a separate native surface that Unistyles' direct
  // ShadowTree patching doesn't reach (same class as AlertHost, fixed in
  // f197051) — without this, a theme switch while the tutorial is open
  // leaves it in the theme active when it was last (re)mounted.
  //
  // `theme` must be destructured/read, not just called for its side effect
  // (#342) — Unistyles only subscribes when `theme` is read from the hook's
  // return value; a bare useUnistyles() call subscribes to nothing, which is
  // why this fix (added alongside AlertHost's, in the same sweep) didn't
  // actually hold either.
  const { theme } = useUnistyles()
  const [rawIndex, setIndex] = useState(0)
  // Reopening starts from step 1: the Modal stays mounted between opens, so
  // the index would otherwise resume where the last run stopped.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setIndex(0)
  }

  if (steps.length === 0) return null
  // A shorter steps array must not index past its end.
  const index = Math.min(rawIndex, steps.length - 1)
  const step = steps[index]
  const isLast = index === steps.length - 1

  const handlePrimary = () => {
    onStepCompleted(index + 1)
    if (isLast) {
      onComplete()
    } else {
      setIndex(index + 1)
    }
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onShow={onShow}
      onRequestClose={() => onSkip(index + 1)}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TextButton
          onPress={() => onSkip(index + 1)}
          tone="muted"
          style={styles.skipBtn}
        >
          Skip
        </TextButton>
        <GlassSurface kind="raised" style={styles.card}>
          {/* Scrolls at the largest font size instead of running under Skip. */}
          <ScrollView
            style={styles.cardScroll}
            contentContainerStyle={styles.cardContent}
          >
            <Text style={styles.counter}>
              {index + 1} / {steps.length}
            </Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            <AppButton onPress={handlePrimary}>{step.primaryLabel}</AppButton>
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  )
}
