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
import { BUTTON_ROW_STACK_FONT_SCALE } from '@/src/shared/config/constants'
import { Children, isValidElement, type ReactNode } from 'react'
import { useWindowDimensions, View } from 'react-native'
import { styles } from './ButtonRow.styles'

interface ButtonRowProps {
  children: ReactNode
}

export function ButtonRow({ children }: ButtonRowProps) {
  // useWindowDimensions updates when the OS font size changes.
  const { fontScale } = useWindowDimensions()
  const stacked = fontScale >= BUTTON_ROW_STACK_FONT_SCALE
  styles.useVariants({ stacked })

  return (
    <View style={styles.row}>
      {/* toArray already gives each child a stable key; an index key moved
          state between cells when a button was inserted in front. */}
      {Children.toArray(children).map((child, i) => (
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
