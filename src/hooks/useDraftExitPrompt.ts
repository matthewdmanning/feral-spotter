/**
 * hooks/useDraftExitPrompt.ts
 * Submission Details' hardware-Back policy (#156). The header back and
 * swipe-back are off there, but Android's Back would pop to Home, which
 * offers a draft's owner nothing. Back instead asks: stay, add more photos,
 * or discard. While a submit runs, Back does nothing: leaving or
 * discarding would pull the draft out from under the send. Only while the
 * screen is focused: it stays mounted under Cat Form and the map picker,
 * whose own Back must not reach this.
 */

import { useBackHandler } from '@/src/hooks/useBackHandler'
import { showAlert } from '@/src/hooks/useUIStore'
import { useIsFocused } from 'expo-router'
import { useCallback } from 'react'

export function useDraftExitPrompt({
  isSubmitting,
  addMore,
  onDiscard,
}: {
  isSubmitting: boolean
  addMore: { label: string; open: () => void }
  onDiscard: () => void
}): void {
  const isFocused = useIsFocused()
  const handleBackPress = useCallback(() => {
    if (!isFocused) return false
    if (isSubmitting) return true
    showAlert('Leave Submission?', 'Your draft is not sent yet.', [
      { text: 'Stay', style: 'cancel' },
      { text: addMore.label, onPress: addMore.open },
      { text: 'Discard Draft', style: 'destructive', onPress: onDiscard },
    ])
    return true
  }, [isFocused, isSubmitting, addMore, onDiscard])
  useBackHandler(handleBackPress)
}
