import { Modal, View, Text, Pressable } from 'react-native'
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
            <Pressable onPress={onContinue} style={[styles.btn, styles.secondary]} accessibilityRole="button">
              <Text style={styles.secondaryText}>Continue</Text>
            </Pressable>
            <Pressable onPress={onAddAnother} style={[styles.btn, styles.primary]} accessibilityRole="button">
              <Text style={styles.primaryText}>Add Cat</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

