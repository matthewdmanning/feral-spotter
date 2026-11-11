/**
 * shared/ui/molecules/ButtonRow.tsx
 *
 * Two or more equal-width buttons side by side, with one gap for every row in
 * the app. At a large OS font size the row stacks instead, so no label is
 * squeezed onto extra lines or clipped (WCAG 1.4.10 reflow).
 *
 * Children are the buttons themselves, without `flex1`: each one sits in an
 * equal-width cell here, so a caller cannot make the cells uneven by accident.
 */

import { useUnistyles } from 'react-native-unistyles'
import { MAX_FONT_SIZE_MULTIPLIER } from '@/src/shared/config/text'
import { BUTTON_ROW_STACK_FONT_SCALE } from '@/src/shared/config/constants'
import { Children, isValidElement, useState, type ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { styles } from './ButtonRow.styles'

interface ButtonRowProps {
  children: ReactNode
}

export function ButtonRow({ children }: ButtonRowProps) {
  // useWindowDimensions updates when the OS font size changes.
  const { fontScale, width } = useWindowDimensions()
  const { theme } = useUnistyles()
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  const items = Children.toArray(children)
  const availableWidth = measuredWidth ?? width - 2 * theme.layout.gutter
  const requiredWidth =
    items.length *
      theme.controlWidth.action *
      Math.min(fontScale, MAX_FONT_SIZE_MULTIPLIER) +
    Math.max(0, items.length - 1) * theme.layout.stackGap
  const stacked =
    fontScale >= BUTTON_ROW_STACK_FONT_SCALE || requiredWidth > availableWidth
  styles.useVariants({ stacked })

  return (
    <View
      style={styles.row}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    >
      {/* toArray already gives each child a stable key; an index key moved
          state between cells when a button was inserted in front. */}
      {items.map((child, i) => (
        <View
          key={isValidElement(child) ? (child.key ?? i) : i}
          style={styles.cell}
        >
          {child}
        </View>
      ))}
    </View>
  )
}
