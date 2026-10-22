import { AmbientBackground } from '@/src/components/atoms/AmbientBackground'
import { AppButton } from '@/src/components/atoms/AppButton'
import { TextButton } from '@/src/components/atoms/TextButton'
import { DisclosureText } from '@/src/components/molecules/DisclosureText'
import { GateScreen } from '@/src/components/molecules/GateScreen'
import consentCopy from '@/src/content/consentDisclosure.json'
import { confirmExitApp } from '@/src/hooks/confirmExitApp'
import { useBackHandler } from '@/src/hooks/useBackHandler'
import { useConsentPermissions } from '@/src/hooks/useConsentPermissions'
import { useCallback } from 'react'
import { Linking, ScrollView, Text, View } from 'react-native'
import { styles } from './index.styles'

const PERMISSION_BLOCKED_BODY =
  "Camera, photo, or location access was denied. Enable it in Settings to continue — you'll be brought back here automatically once it's granted."

export default function ConsentScreen() {
  const { busy, blocked, handleAgree } = useConsentPermissions()

  useBackHandler(useCallback(() => true, []))

  const handleDecline = useCallback(
    () =>
      confirmExitApp(
        consentCopy.declineWarningTitle,
        consentCopy.declineWarningBody,
      ),
    [],
  )

  if (blocked) {
    return (
      <GateScreen
        title="Permission Blocked"
        body={PERMISSION_BLOCKED_BODY}
        primaryLabel="Open Settings"
        onPrimary={() => Linking.openSettings()}
      />
    )
  }

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{consentCopy.title}</Text>
        <DisclosureText />

        <View style={styles.agreeRow}>
          <AppButton onPress={handleAgree} loading={busy}>
            {consentCopy.agreeLabel}
          </AppButton>
        </View>

        <TextButton
          onPress={handleDecline}
          disabled={busy}
          tone="muted"
          underline
          style={styles.declineBtn}
        >
          {consentCopy.declineLabel}
        </TextButton>
      </ScrollView>
    </View>
  )
}
