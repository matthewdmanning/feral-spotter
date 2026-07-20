/**
 * components/organisms/TutorialOverlay.tsx
 * Step-by-step tutorial overlay shown over the annotate screen.
 * Steps are passed as data so future tutorials can reuse the component.
 *
 * Skeleton (first pass): all steps advance via the primary button.
 * TODO(second pass): gesture-validated advancement (draw/adjust/label on a
 * sandboxed sample photo) per docs/design/2026-07-14-annotation-tutorial-spec.md.
 */

import { Modal, Pressable, Text, View } from 'react-native'
import { useState } from 'react'
import { styles } from './TutorialOverlay.styles'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  id: string
  title: string
  body: string
  /** Label for the primary (advance) button on this step */
  primaryLabel: string
}

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

export function TutorialOverlay({ open, steps, onShow, onStepCompleted, onSkip, onComplete }: TutorialOverlayProps) {
  const [index, setIndex] = useState(0)

  if (steps.length === 0) return null
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
    <Modal visible={open} transparent animationType="fade" onShow={onShow} onRequestClose={() => onSkip(index + 1)} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable onPress={() => onSkip(index + 1)} style={styles.skipBtn} accessibilityRole="button">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.counter}>{index + 1} / {steps.length}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <Pressable onPress={handlePrimary} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>{step.primaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
