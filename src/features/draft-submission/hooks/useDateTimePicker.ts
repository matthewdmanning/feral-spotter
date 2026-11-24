/**
 * features/draft-submission/hooks/useDateTimePicker.ts
 * Manages DateTimePicker open state, temp date, iOS/Android step sequencing.
 */

import { useState } from 'react'
import { Platform } from 'react-native'

type PickerMode = 'date' | 'time' | 'datetime'
type StepMode = 'date' | 'time'

export interface DateTimePickerState {
  show: boolean
  tempDate: Date
  currentMode: StepMode
  open: () => void
  setStep: (m: StepMode) => void
  handleChange: (event: unknown, selectedDate?: Date) => void
  handleConfirm: () => void
  handleCancel: () => void
}

export function useDateTimePicker(
  value: Date | undefined,
  mode: PickerMode,
  onChange: (date: Date) => void,
): DateTimePickerState {
  const [show, setShow] = useState(false)
  // An unset value opens the picker at now; only a confirm sets it.
  const [tempDate, setTempDate] = useState(() => value ?? new Date())
  const [currentMode, setCurrentMode] = useState<StepMode>(
    mode === 'datetime' ? 'date' : mode,
  )

  const firstStep: StepMode = mode === 'datetime' ? 'date' : mode
  // Each open starts from the current value at the first step: a cancel on
  // Android's time dialog used to leave the next open on the time step with
  // the cancelled date.
  const open = () => {
    setTempDate(value ?? new Date())
    setCurrentMode(firstStep)
    setShow(true)
  }
  const setStep = (m: StepMode) => setCurrentMode(m)

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false)
    if (!selectedDate) {
      setCurrentMode(firstStep)
      return
    }
    setTempDate(selectedDate)
    if (Platform.OS === 'android') {
      if (mode === 'datetime' && currentMode === 'date') {
        setCurrentMode('time')
        setShow(true)
      } else {
        onChange(selectedDate)
        setCurrentMode('date')
      }
    }
  }

  const handleConfirm = () => {
    onChange(tempDate)
    setShow(false)
    setCurrentMode(mode === 'datetime' ? 'date' : mode)
  }

  const handleCancel = () => {
    setTempDate(value ?? new Date())
    setShow(false)
    setCurrentMode(mode === 'datetime' ? 'date' : mode)
  }

  return {
    show,
    tempDate,
    currentMode,
    open,
    setStep,
    handleChange,
    handleConfirm,
    handleCancel,
  }
}
