import { accountDeletionCopy } from '@/src/features/settings/copy/settingsCopy'
import { authCopy, commonCopy } from '@/src/shared/config/text'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { Text } from '@/src/shared/ui/atoms/Text'
import { TextField } from '@/src/shared/ui/atoms/TextField'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { CheckboxRow } from '@/src/shared/ui/molecules/CheckboxRow'
import { DialogShell } from '@/src/shared/ui/organisms/DialogShell'
import type { useAccountDeletion } from '@/src/workflows/account-deletion/hooks/useAccountDeletion'
import { ActivityIndicator } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './index.styles'

/** The deletion guard (#433): one dialog per step of useAccountDeletion. */
export function AccountDeletionDialogs({
  deletion,
}: {
  deletion: ReturnType<typeof useAccountDeletion>
}) {
  const { theme } = useUnistyles()
  const { step, close } = deletion
  if (step === 'closed') return null

  if (step === 'warning') {
    return (
      <DialogShell
        title={accountDeletionCopy.warningTitle}
        onRequestClose={close}
      >
        <Text style={styles.dialogBody}>{accountDeletionCopy.warningBody}</Text>
        <Text style={styles.dialogBody}>{accountDeletionCopy.pastUseBody}</Text>
        <CheckboxRow
          label={accountDeletionCopy.alsoDeleteSightings}
          checked={deletion.deleteSightings}
          onChange={deletion.setDeleteSightings}
        />
        <ButtonRow>
          <AppButton variant="secondary" onPress={close}>
            {commonCopy.cancel}
          </AppButton>
          <AppButton variant="danger" onPress={deletion.confirmWarning}>
            {accountDeletionCopy.confirm}
          </AppButton>
        </ButtonRow>
      </DialogShell>
    )
  }

  if (step === 'sightingsWarning') {
    return (
      <DialogShell
        title={accountDeletionCopy.sightingsTitle}
        onRequestClose={close}
      >
        <Text style={styles.dialogBody}>
          {accountDeletionCopy.sightingsBody}
        </Text>
        <ButtonRow>
          <AppButton variant="secondary" onPress={close}>
            {commonCopy.cancel}
          </AppButton>
          <AppButton variant="danger" onPress={deletion.confirmSightings}>
            {accountDeletionCopy.sightingsConfirm}
          </AppButton>
        </ButtonRow>
      </DialogShell>
    )
  }

  const deleting = step === 'deleting'
  if (deleting && !deletion.usesPassword) {
    // The provider's own sheet re-authenticates; this is the busy state.
    return (
      <DialogShell
        title={accountDeletionCopy.deletingTitle}
        onRequestClose={() => undefined}
      >
        <ActivityIndicator color={theme.colors.accent} />
      </DialogShell>
    )
  }
  // While deleting, the password dialog stays up as the busy state.
  return (
    <DialogShell
      title={accountDeletionCopy.passwordTitle}
      onRequestClose={deleting ? () => undefined : close}
    >
      <TextField
        label={authCopy.password}
        placeholder={authCopy.password}
        secureTextEntry
        autoComplete="current-password"
        value={deletion.password}
        onChangeText={deletion.setPassword}
        editable={!deleting}
      />
      <ButtonRow>
        <AppButton variant="secondary" onPress={close} disabled={deleting}>
          {commonCopy.cancel}
        </AppButton>
        <AppButton
          variant="danger"
          onPress={deletion.submitPassword}
          disabled={deleting || !deletion.password}
          loading={deleting}
        >
          {deletion.deleteSightings
            ? accountDeletionCopy.sightingsConfirm
            : accountDeletionCopy.confirm}
        </AppButton>
      </ButtonRow>
    </DialogShell>
  )
}
