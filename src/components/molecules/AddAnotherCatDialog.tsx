import { AppButton } from '@/src/components/atoms/AppButton'
import { Modal, View, Text } from 'react-native'
import { styles } from './AddAnotherCatDialog.styles'

interface AddAnotherCatDialogProps { open: boolean; onAddAnother: () => void; onContinue: () => void }

export function AddAnotherCatDialog({ open, onAddAnother, onContinue }: AddAnotherCatDialogProps) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onContinue} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          <Text style={styles.title}>Add Another Cat?</Text>
          <Text style={styles.body}>Do you want to record another cat observation before submitting?</Text>
          <View style={styles.buttons}>
            <AppButton onPress={onContinue} variant="secondary" flex1>Continue</AppButton>
            <AppButton onPress={onAddAnother} flex1>Add Cat</AppButton>
          </View>
        </View>
      </View>
    </Modal>
  )
}

