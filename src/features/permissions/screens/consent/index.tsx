import { AmbientBackground } from '@/src/shared/ui/atoms/AmbientBackground'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { TextButton } from '@/src/shared/ui/atoms/TextButton'
import { DisclosureText } from '@/src/features/permissions/components/DisclosureText'
import consentCopy from '@/src/features/permissions/copy/consentDisclosure.json'
import { confirmExitApp } from '@/src/shared/hooks/confirmExitApp'
import { useBackHandler } from '@/src/shared/hooks/useBackHandler'
import { useConsentPermissions } from '@/src/features/permissions/hooks/useConsentPermissions'
import { useCallback } from 'react'
import { Text } from '@/src/shared/ui/atoms/Text'
import { ScrollView, View } from 'react-native'
import { styles } from './index.styles'

export default function ConsentScreen() {
  const { busy, handleAgree } = useConsentPermissions()

  useBackHandler(useCallback(() => true, []))

  const handleDecline = useCallback(
    () =>
      confirmExitApp(
        consentCopy.declineWarningTitle,
        consentCopy.declineWarningBody,
      ),
    [],
  )

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
