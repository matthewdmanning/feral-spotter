/**
 * features/draft-submission/components/DateTimePicker.tsx
 * All state logic in useDateTimePicker.
 * Migrated from NativeWind → Unistyles v3.
 */

import { commonCopy, submissionCopy } from '@/src/shared/config/text'
import { DialogShell } from '@/src/shared/ui/organisms/DialogShell'
import { AppButton } from '@/src/shared/ui/atoms/AppButton'
import { ButtonRow } from '@/src/shared/ui/molecules/ButtonRow'
import { useDateTimePicker } from '@/src/features/draft-submission/hooks/useDateTimePicker'
import RNDateTimePicker from '@react-native-community/datetimepicker'
import { CalendarIcon } from 'phosphor-react-native/src/icons/Calendar'
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock'
import { Text } from '@/src/shared/ui/atoms/Text'
import { Platform, Pressable, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { styles } from './DateTimePicker.styles'

type PickerMode = 'date' | 'time' | 'datetime'

interface DateTimePickerProps {
  /** Undefined shows `emptyLabel`: an unset time must not read as set. */
  value: Date | undefined
  emptyLabel?: string
  onChange: (date: Date) => void
  mode?: PickerMode
  label?: string
  minimumDate?: Date
  maximumDate?: Date
}

const { dateTime } = submissionCopy

const MODAL_TITLE: Record<PickerMode, string> = {
  date: dateTime.selectDate,
  time: dateTime.selectTime,
  datetime: dateTime.selectDateTime,
}

const STEP_LABEL = { date: dateTime.date, time: dateTime.time } as const

const formatValue = (date: Date, mode: PickerMode) => {
  if (mode === 'date') return date.toLocaleDateString()
  if (mode === 'time')
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function DateTimePickerButton({
  value,
  emptyLabel = '',
  onChange,
  mode = 'datetime',
  label = dateTime.selectDateTime,
  minimumDate,
  maximumDate,
}: DateTimePickerProps) {
  const { theme } = useUnistyles()
  const valueText = value ? formatValue(value, mode) : emptyLabel
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
        // The label alone hid the set value from screen readers.
        accessibilityLabel={[label, valueText].filter(Boolean).join(', ')}
        accessibilityRole="button"
      >
        <Icon size={theme.iconSize.md} color={theme.colors.muted} />
        <Text style={styles.triggerText}>{valueText}</Text>
      </Pressable>

      {/* iOS modal */}
      {Platform.OS === 'ios' && show && (
        <DialogShell title={MODAL_TITLE[mode]} onRequestClose={handleCancel}>
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
              {commonCopy.cancel}
            </AppButton>
            <AppButton onPress={handleConfirm}>{commonCopy.confirm}</AppButton>
          </ButtonRow>
        </DialogShell>
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
