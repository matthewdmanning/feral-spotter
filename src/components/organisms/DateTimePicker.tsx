/**
 * components/organisms/DateTimePicker.tsx
 * All state logic in useDateTimePicker.
 * Migrated from NativeWind → Unistyles v3.
 */

import { useDateTimePicker } from '@/src/hooks/useDateTimePicker'
import RNDateTimePicker from '@react-native-community/datetimepicker'
import { Calendar, Clock } from 'lucide-react-native'
import { Modal, Platform, Pressable, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './DateTimePicker.styles'

type PickerMode = 'date' | 'time' | 'datetime'

interface DateTimePickerProps {
  value: Date; onChange: (date: Date) => void
  mode?: PickerMode; label?: string
  minimumDate?: Date; maximumDate?: Date
}

const MODAL_TITLE: Record<PickerMode, string> = {
  date: 'Select Date',
  time: 'Select Time',
  datetime: 'Select Date & Time',
}

const formatValue = (date: Date, mode: PickerMode) => {
  if (mode === 'date') return date.toLocaleDateString()
  if (mode === 'time') return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function DateTimePickerButton({
  value, onChange, mode = 'datetime',
  label = 'Select Date & Time',
  minimumDate, maximumDate,
}: DateTimePickerProps) {
  const { theme } = useUnistyles()
  const { show, tempDate, currentMode, open, setStep, handleChange, handleConfirm, handleCancel } =
    useDateTimePicker(value, mode, onChange)

  const Icon = mode === 'time' ? Clock : Calendar

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable onPress={open} style={styles.trigger}
        accessibilityLabel={label} accessibilityRole="button">
        <Icon size={16} color={theme.colors.muted} />
        <Text style={styles.triggerText}>{formatValue(value, mode)}</Text>
      </Pressable>

      {/* iOS modal */}
      {Platform.OS === 'ios' && show && (
        <Modal visible transparent animationType="fade"
          onRequestClose={handleCancel} statusBarTranslucent>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{MODAL_TITLE[mode]}</Text>

              {currentMode === 'date' && (
                <RNDateTimePicker value={tempDate} mode="date" display="spinner"
                  onChange={handleChange} minimumDate={minimumDate} maximumDate={maximumDate} />
              )}
              {currentMode === 'time' && (
                <RNDateTimePicker value={tempDate} mode="time" display="spinner" onChange={handleChange} />
              )}

              {mode === 'datetime' && (
                <View style={styles.stepRow}>
                  {(['date', 'time'] as const).map((step) => {
                    const active = currentMode === step
                    return (
                      <Pressable key={step} onPress={() => setStep(step)}
                        style={[styles.stepBtn, active ? styles.stepBtnActive : styles.stepBtnIdle]}>
                        <Text style={active ? styles.stepTextActive : styles.stepTextIdle}>
                          {step.charAt(0).toUpperCase() + step.slice(1)}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              )}

              <View style={styles.actionRow}>
                <Pressable onPress={handleCancel} style={[styles.actionBtn, styles.actionBtnSecondary]}
                  accessibilityRole="button" accessibilityLabel="Cancel">
                  <Text style={styles.actionBtnSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleConfirm} style={[styles.actionBtn, styles.actionBtnPrimary]}
                  accessibilityRole="button" accessibilityLabel="Confirm">
                  <Text style={styles.actionBtnPrimaryText}>Confirm</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Android native picker */}
      {Platform.OS === 'android' && show && (
        <RNDateTimePicker value={tempDate} mode={currentMode} display="default"
          onChange={handleChange} minimumDate={minimumDate} maximumDate={maximumDate} />
      )}
    </View>
  )
}


