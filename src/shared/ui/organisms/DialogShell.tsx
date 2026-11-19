/**
 * components/organisms/DialogShell.tsx
 *
 * The app's centred dialog: a transparent fading Modal, a dimmed backdrop
 * and a raised sheet with a title, whose content scrolls when it cannot fit
 * (the largest font size). AlertHost and DateTimePickerButton used to build
 * this each by hand.
 */

import { GlassSurface } from '@/src/shared/ui/atoms/GlassSurface'
import type { ReactNode } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { Modal, ScrollView, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { dialogShell } from '@/src/shared/ui/organisms/dialogShell.styles'

interface DialogShellProps {
  title: string
  /** Android Back and the iOS dismiss gesture. */
  onRequestClose: () => void
  children: ReactNode
}

export function DialogShell({
  title,
  onRequestClose,
  children,
}: DialogShellProps) {
  // Subscribes to theme changes (#342). A dialog host mounts once at the
  // root and never re-mounts, so without this its text keeps the theme it
  // first rendered with. `theme` must be read: a bare useUnistyles() call
  // registers no subscription.
  const { theme } = useUnistyles()
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View
        style={[
          dialogShell.backdrop,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <GlassSurface kind="raised" style={dialogShell.sheet}>
          <ScrollView
            style={dialogShell.scroll}
            contentContainerStyle={dialogShell.scrollContent}
          >
            <Text style={dialogShell.title}>{title}</Text>
            {children}
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  )
}
