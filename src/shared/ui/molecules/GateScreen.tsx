import { navigationCopy } from '@/src/shared/config/text'
import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { goHome } from '@/src/shared/lib/navigation'
import { Text } from '@/src/shared/ui/atoms/Text'
import { Linking, View } from 'react-native'
import { styles } from './GateScreen.styles'

interface GateScreenProps {
  title: string
  body?: string
  primaryLabel: string
  onPrimary: () => void
  /** Offers the OS settings app, for when permission was denied for good. */
  showOpenSettings?: boolean
}

/**
 * A full-screen stop: something must happen before the screen behind it can
 * work (a permission, a missing camera). One message and one or two actions.
 */
export function GateScreen({
  title,
  body,
  primaryLabel,
  onPrimary,
  showOpenSettings = false,
}: GateScreenProps) {
  return (
    <View style={styles.root}>
      <AmbientBackground />
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      <View style={styles.actions}>
        <AppButton onPress={onPrimary}>{primaryLabel}</AppButton>
        {showOpenSettings ? (
          <AppButton variant="secondary" onPress={() => Linking.openSettings()}>
            {navigationCopy.openSystemSettings}
          </AppButton>
        ) : null}
      </View>
    </View>
  )
}

/** A gate whose one way on is Home. */
export function GoHomeGate({ title, body }: { title: string; body?: string }) {
  return (
    <GateScreen
      title={title}
      body={body}
      primaryLabel={navigationCopy.goHome}
      onPrimary={goHome}
    />
  )
}

/** Shown where the draft could not be restored at startup. */
export function RestoreFailedGate() {
  return (
    <GoHomeGate
      title={navigationCopy.restoreFailed}
      body={navigationCopy.restartToRetry}
    />
  )
}
