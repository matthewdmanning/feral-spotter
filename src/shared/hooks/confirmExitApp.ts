/**
 * shared/hooks/confirmExitApp.ts
 * The "leave the app?" dialog shared by the first-run screens (intro flow,
 * consent), which have nowhere to go back to.
 */

import { commonCopy } from '@/src/shared/config/text'
import { BackHandler, Platform } from 'react-native'
import { showAlert } from './useUIStore'

/**
 * Asks before leaving the app. Back closes the dialog. Exit closes the app on
 * Android; iOS has no supported way to self-terminate, so there Exit only
 * closes the dialog.
 */
export function confirmExitApp(title: string, body: string): void {
  showAlert(title, body, [
    { text: commonCopy.back, style: 'cancel' },
    {
      text: commonCopy.exit,
      style: 'destructive',
      onPress: () => {
        if (Platform.OS === 'android') BackHandler.exitApp()
      },
    },
  ])
}
