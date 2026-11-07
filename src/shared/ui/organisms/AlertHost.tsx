/**
 * components/organisms/AlertHost.tsx
 *
 * Draws the app's dialogs. Mounted once in AppProviders, above every screen.
 *
 * Replaces `Alert.alert`, which renders the *OS* dialog — dark-grey over a
 * Light app, ignoring the theme entirely. Call sites use `showAlert` from
 * useUIStore, which keeps Alert.alert's signature; this is the only place
 * that has to know how a dialog looks.
 */

import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { useUIStore, type AlertButton } from '@/src/shared/hooks/useUIStore'
import { Text, View } from 'react-native'
import { DialogShell } from '@/src/shared/ui/organisms/DialogShell'
import { styles } from './AlertHost.styles'

/** Alert.alert's button styles, mapped onto the ones AppButton has. */
function variantFor(style: AlertButton['style']) {
  if (style === 'destructive') return 'danger' as const
  if (style === 'cancel') return 'secondary' as const
  return 'primary' as const
}

export function AlertHost() {
  const dialog = useUIStore((s) => s.dialog)
  const dismissDialog = useUIStore((s) => s.dismissDialog)

  if (!dialog) return null

  const press = (button: AlertButton) => {
    // Dismiss first: an onPress that opens the next dialog (the submit flow
    // chains two) would otherwise be wiped by this dismiss.
    dismissDialog()
    button.onPress?.()
  }

  // Android's back button dismisses a native alert without running any
  // handler unless one is 'cancel' — match that.
  const cancel = dialog.buttons.find((b) => b.style === 'cancel')
  const onRequestClose = () => (cancel ? press(cancel) : dismissDialog())

  // Two buttons sit side by side, as the native alert does; three or more
  // stack, because side-by-side would push each under the 48dp floor.
  const sideBySide = dialog.buttons.length === 2

  const buttons = dialog.buttons.map((button, index) => (
    <AppButton
      // Index too: two buttons may share a label.
      key={`${index}-${button.text}`}
      onPress={() => press(button)}
      variant={variantFor(button.style)}
    >
      {button.text}
    </AppButton>
  ))

  return (
    <DialogShell title={dialog.title} onRequestClose={onRequestClose}>
      {dialog.message ? (
        <Text style={styles.message}>{dialog.message}</Text>
      ) : null}
      {sideBySide ? (
        <ButtonRow>{buttons}</ButtonRow>
      ) : (
        <View style={styles.buttonColumn}>{buttons}</View>
      )}
    </DialogShell>
  )
}
