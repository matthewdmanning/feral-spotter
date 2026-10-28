/**
 * components/organisms/DateTimePicker.tsx
 * All state logic in useDateTimePicker.
 * Migrated from NativeWind → Unistyles v3.
 */

import { AppButton } from '@/src/components/atoms/AppButton'
import { ButtonRow } from '@/src/components/molecules/ButtonRow'
import { useDateTimePicker } from '@/src/hooks/useDateTimePicker'
import RNDateTimePicker from '@react-native-community/datetimepicker'
import { CalendarIcon } from 'phosphor-react-native/src/icons/Calendar'
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock'
import { Modal, Platform, Pressable, Text, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { dialogShell } from './dialogShell.styles'
import { styles } from './DateTimePicker.styles'

type PickerMode = 'date' | 'time' | 'datetime'

interface DateTimePickerProps {
  value: Date
  onChange: (date: Date) => void
  mode?: PickerMode
  label?: string
  minimumDate?: Date
  maximumDate?: Date
}

const MODAL_TITLE: Record<PickerMode, string> = {
  date: 'Select Date',
  time: 'Select Time',
  datetime: 'Select Date & Time',
}

const STEP_LABEL = { date: 'Date', time: 'Time' } as const

const formatValue = (date: Date, mode: PickerMode) => {
  if (mode === 'date') return date.toLocaleDateString()
  if (mode === 'time')
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function DateTimePickerButton({
  value,
  onChange,
  mode = 'datetime',
  label = 'Select Date & Time',
  minimumDate,
  maximumDate,
}: DateTimePickerProps) {
  const { theme } = useUnistyles()
  const {
    show,
    tempDate,
    currentMode,
    open,
    setStep,
    handleChange,
    handleConfirm,
    handleCancel,
  } = useDateTimePicker(value, mode, onChange)

  const Icon = mode === 'time' ? ClockIcon : CalendarIcon

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={open}
        style={styles.trigger}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        <Icon size={theme.iconSize.md} color={theme.colors.muted} />
        <Text style={styles.triggerText}>{formatValue(value, mode)}</Text>
      </Pressable>

      {/* iOS modal */}
      {Platform.OS === 'ios' && show && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={handleCancel}
          statusBarTranslucent
        >
          <View style={dialogShell.backdrop}>
            <View style={dialogShell.sheet}>
              <Text style={dialogShell.title}>{MODAL_TITLE[mode]}</Text>

              {currentMode === 'date' && (
                <RNDateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={handleChange}
                  minimumDate={minimumDate}
                  maximumDate={maximumDate}
                />
              )}
              {currentMode === 'time' && (
                <RNDateTimePicker
                  value={tempDate}
                  mode="time"
                  display="spinner"
                  onChange={handleChange}
                />
              )}

              {mode === 'datetime' && (
                <View style={styles.stepRow}>
                  {(['date', 'time'] as const).map((step) => (
                    <AppButton
                      key={step}
                      onPress={() => setStep(step)}
                      variant={currentMode === step ? 'primary' : 'secondary'}
                      flex1
                    >
                      {STEP_LABEL[step]}
                    </AppButton>
                  ))}
                </View>
              )}

              <ButtonRow>
                <AppButton onPress={handleCancel} variant="secondary">
                  Cancel
                </AppButton>
                <AppButton onPress={handleConfirm}>Confirm</AppButton>
              </ButtonRow>
            </View>
          </View>
        </Modal>
      )}

      {/* Android native picker */}
      {Platform.OS === 'android' && show && (
        <RNDateTimePicker
          value={tempDate}
          mode={currentMode}
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  )
}
