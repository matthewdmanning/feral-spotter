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

import { AppButton } from '@/src/components/atoms/AppButton'
import { useUIStore, type AlertButton } from '@/src/hooks/useUIStore'
import { Modal, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { dialogShell } from './dialogShell.styles'
import { styles } from './AlertHost.styles'

/** Alert.alert's button styles, mapped onto the ones AppButton has. */
function variantFor(style: AlertButton['style']) {
  if (style === 'destructive') return 'danger' as const
  if (style === 'cancel') return 'secondary' as const
  return 'primary' as const
}

export function AlertHost() {
  // Subscribes this component to theme changes. Required, not decorative:
  // AlertHost mounts once at the app root and never re-mounts, so without it
  // its Text styles stay at whatever the theme was at first mount — a Dark
  // switch left near-black title and message on the dark card (found on
  // device 2026-08-27). The buttons hid it, since AppButton re-resolves
  // through styles.useVariants() on every render.
  //
  // `theme` must be destructured, not just called for its side effect
  // (#342) — Unistyles only registers the subscription when `theme` is
  // read from the hook's return value; calling useUnistyles() bare
  // subscribes to nothing, which is why f197051's original fix here didn't
  // actually hold.
  const { theme } = useUnistyles()
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

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={dialogShell.backdrop}>
        <View style={dialogShell.sheet}>
          <Text style={dialogShell.title}>{dialog.title}</Text>
          {dialog.message ? (
            <Text style={styles.message}>{dialog.message}</Text>
          ) : null}
          <View style={sideBySide ? styles.buttonRow : styles.buttonColumn}>
            {dialog.buttons.map((button) => (
              <AppButton
                key={button.text}
                onPress={() => press(button)}
                variant={variantFor(button.style)}
                flex1={sideBySide}
              >
                {button.text}
              </AppButton>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}
