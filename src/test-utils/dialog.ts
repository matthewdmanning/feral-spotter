/**
 * test-utils/dialog.ts
 * Presses a button on the open app dialog the way AlertHost does, then
 * awaits its handler so async success/failure handling has finished.
 */

import { act } from '@testing-library/react-native'
import {
  pressDialogButton as runDialogButton,
  useUIStore,
} from '@/src/shared/hooks/useUIStore'

export async function pressDialogButton(text: string): Promise<void> {
  const dialog = useUIStore.getState().dialog
  const button = dialog?.buttons.find((b) => b.text === text)
  if (!button) {
    throw new Error(
      `No dialog button "${text}". Open dialog: ${dialog ? `"${dialog.title}"` : 'none'}`,
    )
  }
  await act(async () => {
    await runDialogButton(button)
  })
}
