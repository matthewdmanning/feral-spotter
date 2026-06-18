import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create((theme) => ({
  // No layout styles — StatusIcon renders only an icon component.
  // Theme colour values are read directly via `theme` in the component.
  // This file exists to satisfy the co-location rule and provide
  // the STATUS_COLOR_KEY lookup typed against theme tokens.
}))

export const STATUS_COLOR_KEY = {
  'In Progress': 'accent',
  'Sending':     'warning',
  'Submitted':   'success',
  'Failed':      'danger',
} as const
