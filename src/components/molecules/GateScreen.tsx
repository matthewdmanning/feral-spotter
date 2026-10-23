import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { AppButton } from '@/src/components/atoms/AppButton'
import { Linking, Text, View } from 'react-native'
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
            Open Settings
          </AppButton>
        ) : null}
      </View>
    </View>
  )
}
