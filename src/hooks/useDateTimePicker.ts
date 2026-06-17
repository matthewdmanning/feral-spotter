/**
 * hooks/useDateTimePicker.ts
 * Manages DateTimePicker open state, temp date, iOS/Android step sequencing.
 */

import { useState } from 'react'
import { Platform } from 'react-native'

type PickerMode = 'date' | 'time' | 'datetime'
type StepMode   = 'date' | 'time'

export interface DateTimePickerState {
  show:        boolean
  tempDate:    Date
  currentMode: StepMode
  open:        () => void
  setStep:     (m: StepMode) => void
  handleChange:(event: unknown, selectedDate?: Date) => void
  handleConfirm: () => void
  handleCancel:  () => void
}

export function useDateTimePicker(
  value:    Date,
  mode:     PickerMode,
  onChange: (date: Date) => void,
): DateTimePickerState {
  const [show,        setShow]        = useState(false)
  const [tempDate,    setTempDate]    = useState(value)
  const [currentMode, setCurrentMode] = useState<StepMode>(
    mode === 'datetime' ? 'date' : mode,
  )

  const open    = () => setShow(true)
  const setStep = (m: StepMode) => setCurrentMode(m)

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShow(false)
    if (!selectedDate) return
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
    setTempDate(value)
    setShow(false)
    setCurrentMode(mode === 'datetime' ? 'date' : mode)
  }

  return {
    show, tempDate, currentMode,
    open, setStep,
    handleChange, handleConfirm, handleCancel,
  }
}
